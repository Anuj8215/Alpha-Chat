require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/users');

async function createAdminUser(email, password, firstName = 'Admin', lastName = 'User') {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log(`User with email ${email} already exists. Making them admin...`);
            const updatedUser = await User.findOneAndUpdate(
                { email },
                { role: 'admin' },
                { new: true }
            );
            console.log(`✅ User ${updatedUser.firstName} ${updatedUser.lastName} (${email}) is now an ADMIN`);
            return;
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
                    dailyChatLimit: 1000,
                    dailyImageLimit: 100,
                    dailyVideoLimit: 50,
                    fileUploadLimit: 100,
                    canAccessGPT4: true,
                    canAccessAdvancedFeatures: true
                }
            }
        });

        await adminUser.save();
        console.log(`✅ Admin user created successfully!`);
        console.log(`👤 Name: ${firstName} ${lastName}`);
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 Password: ${password}`);
        console.log(`👑 Role: admin`);
        console.log(`\n🚀 You can now login with these credentials and access all admin routes!`);

    } catch (error) {
        console.error('Error creating admin user:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

async function makeUserAdmin(email) {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find and update user to admin
        const user = await User.findOneAndUpdate(
            { email: email },
            { role: 'admin' },
            { new: true }
        );

        if (!user) {
            console.log(`User with email ${email} not found`);
            return;
        }

        console.log(`✅ User ${user.firstName} ${user.lastName} (${email}) is now an ADMIN`);
        console.log('You can now test admin routes with this user account');

    } catch (error) {
        console.error('Error making user admin:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Command line usage
const command = process.argv[2];
const email = process.argv[3];

if (!command) {
    console.log('Usage:');
    console.log('  Create new admin: node make-admin.js create <email> <password> [firstName] [lastName]');
    console.log('  Make existing user admin: node make-admin.js promote <email>');
    console.log('');
    console.log('Examples:');
    console.log('  node make-admin.js create admin@alphachat.com mySecurePass123 Admin User');
    console.log('  node make-admin.js promote user@example.com');
    process.exit(1);
}

if (command === 'create') {
    const password = process.argv[4];
    const firstName = process.argv[5] || 'Admin';
    const lastName = process.argv[6] || 'User';

    if (!email || !password) {
        console.log('Error: Email and password are required for creating admin');
        console.log('Usage: node make-admin.js create <email> <password> [firstName] [lastName]');
        process.exit(1);
    }

    createAdminUser(email, password, firstName, lastName);
} else if (command === 'promote') {
    if (!email) {
        console.log('Error: Email is required for promoting user');
        console.log('Usage: node make-admin.js promote <email>');
        process.exit(1);
    }

    makeUserAdmin(email);
} else {
    console.log('Invalid command. Use "create" or "promote"');
    process.exit(1);
}