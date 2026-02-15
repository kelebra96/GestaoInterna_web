import { NextResponse } from 'next/server';
import { applyPatch } from 'diff';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type CodePatch = { path: string; patch: string };

type ProposalStructured = {
  codePatches?: CodePatch[];
};

type ChamadoDoc = {
  status?: string;
  approved_by?: string | null;
  proposal?: {
    structured?: ProposalStructured;
  };
};

const GITHUB_API = 'https://api.github.com';

function getEnv() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    throw new Error('GITHUB_TOKEN e GITHUB_REPO são obrigatórios para criar PR automaticamente');
  }
  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    throw new Error('GITHUB_REPO deve estar no formato "owner/repo"');
  }
  return { token, owner, repoName };
}

async function githubRequest(path: string, init: RequestInit & { token: string }) {
  const { token, ...rest } = init;
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...rest.headers,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${txt}`);
  }
  return res;
}

async function getDefaultBranch(token: string, owner: string, repo: string) {
  const res = await githubRequest(`/repos/${owner}/${repo}`, { method: 'GET', token });
  const data = await res.json();
  return data.default_branch as string;
}

async function getRefSha(token: string, owner: string, repo: string, branch: string) {
  const res = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
    method: 'GET',
    token,
  });
  const data = await res.json();
  return data.object?.sha as string;
}

async function createBranch(token: string, owner: string, repo: string, branch: string, baseSha: string) {
  await githubRequest(`/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    }),
  });
}

async function getFile(token: string, owner: string, repo: string, path: string, branch: string) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 404) {
    return { content: '', sha: null as string | null };
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub contents error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const buff = Buffer.from(data.content, 'base64');
  return { content: buff.toString('utf8'), sha: data.sha as string };
}

async function putFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
  content: string,
  message: string,
  sha: string | null
) {
  await githubRequest(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    token,
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      sha: sha || undefined,
    }),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { chamadoId } = body as { chamadoId?: string };
    if (!chamadoId) {
      return NextResponse.json({ error: 'chamadoId é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('chamados')
      .select('*')
      .eq('id', chamadoId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });
    }

    const chamadoData = data as ChamadoDoc;
    if (!chamadoData || chamadoData.status !== 'approved' || !chamadoData.approved_by) {
      return NextResponse.json(
        { error: 'Chamado precisa estar aprovado e conter approvedBy' },
        { status: 400 }
      );
    }

    const structured = data.proposal?.structured as ProposalStructured | undefined;
    const codePatches = structured?.codePatches;

    if (!Array.isArray(codePatches) || codePatches.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum codePatch encontrado em proposal.structured.codePatches' },
        { status: 400 }
      );
    }

    const { token, owner, repoName } = getEnv();
    const branchName = `ia/chamado-${chamadoId}`;

    const defaultBranch = await getDefaultBranch(token, owner, repoName);
    const baseSha = await getRefSha(token, owner, repoName, defaultBranch);

    // Cria branch; se já existir, falha para evitar sobreposição
    try {
      await createBranch(token, owner, repoName, branchName, baseSha);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Reference already exists')) {
        return NextResponse.json(
          { error: `Branch ${branchName} já existe; limpe ou use outro chamadoId` },
          { status: 409 }
        );
      }
      throw err;
    }

    const commitMessage = `ia: aplicar patches do chamado ${chamadoId}`;

    for (const patch of codePatches) {
      if (!patch || typeof patch.path !== 'string' || typeof patch.patch !== 'string') {
        return NextResponse.json(
          { error: 'codePatches inválidos: cada item deve ter path (string) e patch (string)' },
          { status: 400 }
        );
      }

      const { content: baseContent, sha } = await getFile(token, owner, repoName, patch.path, branchName);
      const patched = applyPatch(baseContent, patch.patch);

      if (patched === false) {
        return NextResponse.json(
          { error: `Falha ao aplicar patch em ${patch.path}` },
          { status: 400 }
        );
      }

      await putFile(token, owner, repoName, patch.path, branchName, patched, commitMessage, sha);
    }

    const prRes = await githubRequest(`/repos/${owner}/${repoName}/pulls`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        title: `IA: chamado ${chamadoId}`,
        head: branchName,
        base: defaultBranch,
        body: `PR gerado automaticamente a partir de proposal.structured.codePatches do chamado ${chamadoId}.`,
      }),
    });
    const prData = await prRes.json();

    return NextResponse.json({ pr: { url: prData.html_url, number: prData.number, branch: branchName } });
  } catch (error) {
    console.error('Erro ao criar PR automático:', error);
    const message = error instanceof Error ? error.message : 'Falha ao criar PR automático';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
