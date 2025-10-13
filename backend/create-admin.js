require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/users');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function createAdminUser() {
    try {
        console.log('� Alpha-Chat Admin User Setup');
        console.log('='.repeat(40));

        // Get admin details from user input
        const email = await askQuestion('Enter admin email: ');
        const password = await askQuestion('Enter admin password (min 8 characters): ');
        const firstName = await askQuestion('Enter first name (default: Admin): ') || 'Admin';
        const lastName = await askQuestion('Enter last name (default: User): ') || 'User';

        rl.close();

        // Validate password
        if (password.length < 8) {
            console.log('❌ Password must be at least 8 characters long');
            return;
        }

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            if (existingAdmin.role === 'admin') {
                console.log('✅ Admin user already exists with this email!');
                console.log(`📧 Email: ${email}`);
                console.log('� You can login with your existing password.');
                return;
            } else {
                // Update password and promote to admin
                existingAdmin.password = password; // Will be hashed by pre-save hook
                existingAdmin.role = 'admin';
                existingAdmin.isVerified = true;
                existingAdmin.subscription = {
                    type: 'pro',
                    features: {
                        dailyChatLimit: 9999,
                        dailyImageLimit: 999,
                        dailyVideoLimit: 999,
                        fileUploadLimit: 999,
                        canAccessGPT4: true,
                        canAccessAdvancedFeatures: true
                    }
                };
                await existingAdmin.save();
                console.log('✅ Existing user promoted to admin and password updated!');
                console.log(`📧 Email: ${email}`);
                return;
            }
        }

        // Create new admin user
        const adminUser = new User({
            firstName,
            lastName,
            email,
            password, // Will be hashed by pre-save hook
            role: 'admin',
            authProvider: 'local',
            isVerified: true,
            subscription: {
                type: 'pro',
                features: {
                    dailyChatLimit: 9999,
                    dailyImageLimit: 999,
                    dailyVideoLimit: 999,
                    fileUploadLimit: 999,
                    canAccessGPT4: true,
                    canAccessAdvancedFeatures: true
                }
            }
        });

        await adminUser.save();

        console.log('🎉 Admin user created successfully!');
        console.log('='.repeat(50));
        console.log('👑 ADMIN LOGIN CREDENTIALS:');
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 Password: ${'*'.repeat(password.length)} (hidden for security)`);
        console.log('='.repeat(50));
        console.log('🚀 You can now login and access all admin routes!');
        console.log('📱 Use these credentials in Postman or your frontend.');
        console.log('⚠️  IMPORTANT: Keep these credentials secure!');

    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Command line usage with arguments (optional)
const email = process.argv[2];
const password = process.argv[3];
const firstName = process.argv[4] || 'Admin';
const lastName = process.argv[5] || 'User';

if (email && password) {
    // Use command line arguments
    rl.close();
    createAdminFromArgs(email, password, firstName, lastName);
} else {
    // Interactive mode
    createAdminUser();
}

async function createAdminFromArgs(email, password, firstName, lastName) {
    try {
        // Validate password
        if (password.length < 8) {
            console.log('❌ Password must be at least 8 characters long');
            return;
        }

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            if (existingAdmin.role === 'admin') {
                console.log('✅ Admin user already exists with this email!');
                return;
            } else {
                // Update password and promote to admin
                existingAdmin.password = password;
                existingAdmin.role = 'admin';
                existingAdmin.isVerified = true;
                await existingAdmin.save();
                console.log('✅ Existing user promoted to admin!');
                return;
            }
        }

        // Create new admin user
        const adminUser = new User({
            firstName,
            lastName,
            email,
            password,
            role: 'admin',
            authProvider: 'local',
            isVerified: true,
            subscription: {
                type: 'pro',
                features: {
                    dailyChatLimit: 9999,
                    dailyImageLimit: 999,
                    dailyVideoLimit: 999,
                    fileUploadLimit: 999,
                    canAccessGPT4: true,
                    canAccessAdvancedFeatures: true
                }
            }
        });

        await adminUser.save();

        console.log('🎉 Admin user created successfully!');
        console.log(`📧 Email: ${email}`);
        console.log(`👤 Name: ${firstName} ${lastName}`);
        console.log(`🔑 Password: Set successfully (not displayed for security)`);

    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}