const fs = require('fs');
const path = require('path');

// Arquivos que precisam ser atualizados
const filesToUpdate = [
  'app/api/inventario/[id]/import/route.ts',
  'app/api/inventario/[id]/finalize/route.ts',
  'app/api/inventario/[id]/download-output/route.ts',
  'app/api/inventario/[id]/addresses/generate/route.ts',
  'app/api/inventario/[id]/addresses/generate-range/route.ts',
  'app/api/inventario/[id]/delete/route.ts',
  'app/api/inventario/[id]/addresses/checkin/route.ts',
  'app/api/inventario/[id]/addresses/checkout/route.ts',
  'app/api/inventario/[id]/count/route.ts',
  'app/api/inventario/[id]/items/route.ts',
];

const importToAdd = "import { isAuthorizedToAccessInventory } from '@/lib/helpers/inventory-auth';";

const oldAuthPattern = `    const inventoryData = inventorySnap.data();
    const isAuthorizedCompany = auth.role === 'super_admin' || inventoryData?.companyId === auth.orgId;

    if (!isAuthorizedCompany) {
      return NextResponse.json(
        { error: 'Acesso negado a este inventário' },
        { status: 403 }
      );
    }`;

const newAuthPattern = `    const inventoryData = inventorySnap.data();

    // Verificar autorização usando helper
    if (!isAuthorizedToAccessInventory(auth, inventoryData)) {
      return NextResponse.json(
        { error: 'Acesso negado a este inventário' },
        { status: 403 }
      );
    }`;

let updatedCount = 0;
let errorCount = 0;

filesToUpdate.forEach((filePath) => {
  const fullPath = path.join(__dirname, '..', filePath);

  try {
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Arquivo não encontrado: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');

    // Verificar se já tem o import
    if (!content.includes(importToAdd)) {
      // Adicionar import após o último import de helpers/auth
      content = content.replace(
        /import { getAuthFromRequest } from '@\/lib\/helpers\/auth';/,
        `import { getAuthFromRequest } from '@/lib/helpers/auth';\n${importToAdd}`
      );
    }

    // Substituir o padrão de autenticação antigo
    if (content.includes(oldAuthPattern)) {
      content = content.replace(oldAuthPattern, newAuthPattern);
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Atualizado: ${filePath}`);
      updatedCount++;
    } else {
      console.log(`⏭️  Já atualizado ou padrão não encontrado: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao processar ${filePath}:`, error.message);
    errorCount++;
  }
});

console.log('\n=== Resumo ===');
console.log(`Arquivos atualizados: ${updatedCount}`);
console.log(`Erros: ${errorCount}`);
console.log(`Total processado: ${filesToUpdate.length}`);
