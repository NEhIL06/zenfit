
import fetch from 'node-fetch';

async function testChat() {
    try {
        const response = await fetch('http://localhost:3000/api/ai-trainer/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'How do I do a pushup?',
                userId: 'test-user-123',
                conversationId: 'test-conv'
            })
        });

        if (!response.ok) {
            console.error('Chat API failed:', response.status, await response.text());
            return;
        }

        const data = await response.json();
        console.log('Chat API Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testChat();
