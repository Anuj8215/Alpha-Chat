const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: ['general', 'ai', 'limits', 'security', 'payments', 'notifications']
    },
    key: {
        type: String,
        required: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    dataType: {
        type: String,
        enum: ['string', 'number', 'boolean', 'object', 'array'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    isEditable: {
        type: Boolean,
        default: true
    },
    lastModified: {
        type: Date,
        default: Date.now
    },
    modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Compound index for category + key (unique combination)
systemSettingsSchema.index({ category: 1, key: 1 }, { unique: true });

// Instance method to get typed value
systemSettingsSchema.methods.getTypedValue = function () {
    const { value, dataType } = this;

    switch (dataType) {
        case 'number':
            return Number(value);
        case 'boolean':
            return Boolean(value);
        case 'object':
        case 'array':
            return typeof value === 'string' ? JSON.parse(value) : value;
        default:
            return String(value);
    }
};

// Static method to get settings by category
systemSettingsSchema.statics.getByCategory = async function (category) {
    const settings = await this.find({ category }).lean();
    const result = {};

    settings.forEach(setting => {
        result[setting.key] = setting.value;
    });

    return result;
};

// Static method to update or create setting
systemSettingsSchema.statics.setSetting = async function (category, key, value, dataType, description, modifiedBy) {
    return await this.findOneAndUpdate(
        { category, key },
        {
            value,
            dataType,
            description,
            lastModified: new Date(),
            modifiedBy
        },
        {
            upsert: true,
            new: true,
            runValidators: true
        }
    );
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);