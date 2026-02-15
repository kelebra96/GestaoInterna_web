"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Visualization = {
  title?: string;
  type?: string;
  spec?: unknown;
};

type Proposal = {
  structured?: {
    insights?: string[];
    visualizations?: Visualization[];
    codePatches?: { path?: string; patch?: string }[];
    raw?: unknown;
  };
  content?: string;
  generatedAt?: string;
};

type Chamado = {
  id: string;
  title: string;
  description: string;
  createdAt?: string | null;
  status?: string;
  proposal?: Proposal;
};

export default function SupportRequestsList() {
  const [items, setItems] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Chamado | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = async (): Promise<Chamado[]> => {
    setLoading(true);
    try {
      const res = await fetch("/api/chamados");
      const data = await res.json();
      const chamados = Array.isArray(data?.chamados) ? (data.chamados as Chamado[]) : [];
      setItems(chamados);
      return chamados;
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const { user } = useAuth();

  const generateAI = async (id: string) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chamadoId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        const newItems = await load();
        const updated = newItems.find((item) => item.id === id) || null;
        if (updated) setSelected(updated);
      } else {
        alert(data.error || "Erro ao gerar proposta");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const approve = async (id: string) => {
    if (!user) {
      alert("Usuário não autenticado");
      return;
    }
    try {
      const res = await fetch("/api/chamados/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approverId: user.uid }),
      });
      const data = await res.json();
      if (res.ok) {
        await load();
        alert("Proposta aprovada");
      } else {
        alert(data.error || "Erro ao aprovar proposta");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Chamados</h3>
        {loading ? (
          <div>Carregando...</div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="p-2 border rounded flex justify-between items-start">
                <div>
                  <div className="font-medium">{it.title}</div>
                  <div className="text-sm text-gray-600">{it.description}</div>
                  <div className="text-xs text-gray-400">{it.createdAt}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    className="px-2 py-1 bg-green-600 text-white rounded"
                    onClick={() => setSelected(it)}>
                    Ver
                  </button>
                  <button
                    className="px-2 py-1 bg-indigo-600 text-white rounded"
                    onClick={() => generateAI(it.id)}
                    disabled={generating}>
                    {generating ? "Gerando..." : "Gerar proposta IA"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="p-3 border rounded">
          <h4 className="font-semibold">Detalhes</h4>
          <div className="mt-2">
            <div className="font-medium">{selected.title}</div>
            <div className="text-sm text-gray-700">{selected.description}</div>
            <div className="mt-3">
              <h5 className="font-medium">Proposta IA</h5>
              <div className="text-sm mt-1">
                {selected.proposal?.structured ? (
                  <div>
                    <h6 className="font-semibold">Insights</h6>
                    {selected.proposal.structured.insights?.length ? (
                      <ul className="list-disc ml-5">
                        {selected.proposal.structured.insights.map(
                          (insight, idx) => (
                            <li key={idx}>{insight}</li>
                          )
                        )}
                      </ul>
                    ) : (
                      <div className="text-gray-500">
                        Nenhum insight gerado ainda.
                      </div>
                    )}

                    <h6 className="font-semibold mt-2">
                      Visualizações sugeridas
                    </h6>
                    {selected.proposal.structured.visualizations?.length ? (
                      <ul className="list-disc ml-5">
                        {selected.proposal.structured.visualizations.map(
                          (v, idx) => (
                            <li key={idx}>
                              <div className="font-medium">
                                {v.title} ({v.type})
                              </div>
                              <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded mt-1">
                                {JSON.stringify(v.spec ?? null, null, 2)}
                              </pre>
                            </li>
                          )
                        )}
                      </ul>
                    ) : (
                      <div className="text-gray-500">
                        Nenhuma visualização sugerida.
                      </div>
                    )}

                    {selected.proposal.structured.raw !== undefined &&
                      selected.proposal.structured.raw !== null && (
                      <div className="mt-3">
                        <h6 className="font-semibold">Resposta bruta</h6>
                        <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded mt-1">
                          {JSON.stringify(selected.proposal.structured.raw, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-2 rounded mt-1">
                    {selected.proposal?.content ||
                      "Nenhuma proposta gerada ainda."}
                  </pre>
                )}
              </div>
              {user?.role === "developer" && selected.proposal && (
                <div className="mt-3">
                  <button
                    className="px-3 py-1 bg-emerald-600 text-white rounded"
                    onClick={() => approve(selected.id)}>
                    Aprovar proposta (developer)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
