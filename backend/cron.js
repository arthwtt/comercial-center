const cron = require('node-cron');
const chatwootService = require('./services/chatwoot');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Sync Boards cada 1 Hora
cron.schedule('0 * * * *', async () => {
    try {
        console.log('[CRON] Iniciando sync de boards do Chatwoot...');
        
        // 1. Puxar boards do chatwoot
        const boardsData = await chatwootService.getSystemBoards(); // mocked method
        if (!boardsData || !boardsData.length) return;

        // 2. Para cada board, salvar/atualizar
        for (const b of boardsData) {
            await prisma.board.upsert({
                where: { id: String(b.id) },
                update: { name: b.name, synced_at: new Date() },
                create: { id: String(b.id), name: b.name, synced_at: new Date() }
            });

            // Lidar com steps
            if (b.steps && b.steps.length > 0) {
                for (const [index, step] of b.steps.entries()) {
                    await prisma.step.upsert({
                        where: { id: String(step.id) },
                        update: { name: step.name, position: index },
                        create: { 
                            id: String(step.id), 
                            name: step.name, 
                            board_id: String(b.id), 
                            position: index 
                        }
                    });
                }
            }
        }
        console.log('[CRON] Sync Finalizado com Sucesso.');
    } catch (e) {
        console.error('[CRON] Erro no sync de boards:', e.message);
    }
});

module.exports = cron;
