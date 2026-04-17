const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function run() {
    const prisma = new PrismaClient();
    try {
        console.log("-- Testando db local --");
        const count = await prisma.leadStaging.count();
        console.log("Leads em Staging nativo:", count);
        
        console.log("\n-- Inserindo um Lead via API (Testando Multer e Prisma) --");
        const form = new FormData();
        form.append('file', fs.createReadStream('../test_leads.csv'));
        
        const res = await axios.post('http://localhost:3000/api/leads/import', form, {
            headers: form.getHeaders()
        });
        
        console.log("Resposta da API:", res.data);
    } catch(e) {
        console.error("Erro no teste:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
run();
