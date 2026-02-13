# AGENTS.md instructions for /var/www/gestaointerna

Configurações no GitHub (Settings → Secrets and variables → Actions → Secrets):

- SSH_HOST = IP ou domínio do servidor
- SSH_USER = usuário SSH
- SSH_KEY = chave privada do SSH (conteúdo completo)
- SSH_PORT = porta (ex: 22)
- APP_DIR = /var/www/gestaointerna
- PM2_APP_NAME = nome do processo (ex: myinventory)

Se sua branch principal não for master
Troque no arquivo .github/workflows/deploy.yml para main (ou a branch correta) nas linhas:

- branches: ["master"]
- git reset --hard origin/master

Checklist rápido no servidor

- O usuário do SSH precisa ter acesso a /var/www/gestaointerna.
- O git pull no servidor deve funcionar sem pedir senha (configure chave/credencial do repositório).
- O PM2 precisa ter o processo criado com o nome definido em PM2_APP_NAME.
- Se .env for versionado, o git reset --hard pode sobrescrever. Se for sensível, mantenha fora do repo.
