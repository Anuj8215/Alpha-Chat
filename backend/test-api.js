//!SECTION - SIMPLE API TEST FOR ALPHA CHAT

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
    console.log('🚀 Testing Alpha Chat API...');

    try {
        // Test 1: Health Check
        console.log('\n1. Testing Health Endpoint...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health Check:', healthResponse.data);

        // Test 2: Register User
        console.log('\n2. Testing User Registration...');
        const registerData = {
            firstName: 'Test',
            lastName: 'User',
            email: `test${Date.now()}@example.com`,
            password: 'password123'
        };

        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, registerData);
        console.log('✅ User Registration:', registerResponse.data.message);

        // Test 3: Login User
        console.log('\n3. Testing User Login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: registerData.email,
            password: registerData.password
        });
        console.log('✅ User Login:', loginResponse.data.message);

        const token = loginResponse.data.token;
        const headers = { Authorization: `Bearer ${token}` };

        // Test 4: Get User Profile
        console.log('\n4. Testing Get Profile...');
        const profileResponse = await axios.get(`${BASE_URL}/api/auth/me`, { headers });
        console.log('✅ Get Profile:', profileResponse.data.message);

        // Test 5: Create Conversation
        console.log('\n5. Testing Create Conversation...');
        const conversationResponse = await axios.post(`${BASE_URL}/api/ai/conversation/new`, {
            aiMode: 'chat',
            title: 'Test Chat'
        }, { headers });
        console.log('✅ Create Conversation:', conversationResponse.data.message);

        const conversationId = conversationResponse.data.conversation._id;

        // Test 6: Send Chat Message
        console.log('\n6. Testing Chat Message...');
        const chatResponse = await axios.post(`${BASE_URL}/api/ai/chat`, {
            conversationId: conversationId,
            message: 'Hello! This is a test message.'
        }, { headers });
        console.log('✅ Chat Response:', chatResponse.data.message);

        console.log('\n🎉 All tests passed! Your Alpha Chat backend is working perfectly!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
        console.error('URL:', error.config?.url);
    }
}

// Run tests
testAPI();