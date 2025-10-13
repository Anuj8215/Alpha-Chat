//!SECTION - EMAIL TEST SCRIPT

require('dotenv').config();
const { sendPasswordResetEmail, verifyTransporter } = require('./src/services/emailService');

async function testEmail() {
    console.log('📧 Testing Email Configuration...');

    try {
        // First verify the transporter
        console.log('\n1. Verifying email transporter...');
        await verifyTransporter();
        console.log('✅ Email transporter verified successfully!');

        // Test sending a password reset email
        console.log('\n2. Testing password reset email...');
        const testEmail = 'anujpawar1010@gmail.com'; // Using your email for testing
        const testToken = 'test-reset-token-12345';

        await sendPasswordResetEmail(testEmail, testToken);
        console.log('✅ Password reset email sent successfully!');
        console.log(`📧 Check your inbox at ${testEmail} for the test email.`);

    } catch (error) {
        console.error('\n❌ Email test failed:', error.message);
        console.error('\n🔧 Troubleshooting steps:');
        console.error('1. Make sure you have 2-factor authentication enabled on Gmail');
        console.error('2. Generate an app password from Google Account settings');
        console.error('3. Update SMTP_PASS in .env with your app password');
        console.error('4. Make sure SMTP_USER is set to anujpawar1010@gmail.com');
    }
}

// Run email test
testEmail();