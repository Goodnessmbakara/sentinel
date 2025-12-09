// Diagnostic script to list available Gemini models for the API key
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listAvailableModels() {
    const apiKey = process.env.LLM_API_KEY?.trim();
    
    console.log('🔍 Gemini Model Discovery Tool\n');
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT SET');
    console.log('Key Length:', apiKey?.length, '\n');

    if (!apiKey) {
        console.error('❌ LLM_API_KEY not set in .env');
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        console.log('📡 Fetching available models from Google Generative AI API...\n');
        
        // Try to list models (SDK method if available)
        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey
        );
        
        const data = await response.json();
        
        if (data.error) {
            console.error('❌ API Error:', data.error.message);
            console.error('Status:', data.error.status);
            console.error('Details:', JSON.stringify(data.error, null, 2));
            process.exit(1);
        }
        
        if (data.models) {
            console.log(`✅ Found ${data.models.length} available models:\n`);
            
            const supportedModels = data.models.filter(m => 
                m.supportedGenerationMethods?.includes('generateContent')
            );
            
            console.log('Models supporting generateContent:\n');
            supportedModels.forEach(model => {
                console.log(`📦 ${model.name}`);
                console.log(`   Display: ${model.displayName}`);
                console.log(`   Description: ${model.description?.substring(0, 100)}...`);
                console.log(`   Methods: ${model.supportedGenerationMethods.join(', ')}`);
                console.log('');
            });
            
            console.log('\n✨ Recommended model names to use in code:');
            supportedModels.slice(0, 3).forEach(m => {
                const shortName = m.name.replace('models/', '');
                console.log(`   - "${shortName}"`);
            });
            
        } else {
            console.log('⚠️  No models found in response');
            console.log('Response:', JSON.stringify(data, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error fetching models:', error.message);
        console.error(error);
    }
}

listAvailableModels();
