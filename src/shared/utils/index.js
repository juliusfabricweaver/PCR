"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = exports.generateId = exports.debounce = exports.storage = exports.pick = exports.omit = exports.sortBy = exports.groupBy = exports.getPainDescription = exports.formatVitalSigns = exports.calculateAge = exports.validatePassword = exports.validateZipCode = exports.validateSSN = exports.validatePhone = exports.validateEmail = exports.maskSSN = exports.formatPhoneNumber = exports.formatSSN = exports.formatName = exports.capitalize = exports.isValidDate = exports.getCurrentDateTime = exports.formatTime = exports.formatDate = void 0;
const constants_1 = require("../constants");
// Date utilities
const formatDate = (date, format = 'short') => {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
        return 'Invalid Date';
    }
    switch (format) {
        case 'short':
            return d.toLocaleDateString();
        case 'long':
            return d.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        case 'datetime':
            return d.toLocaleString();
        default:
            return d.toLocaleDateString();
    }
};
exports.formatDate = formatDate;
const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
    });
};
exports.formatTime = formatTime;
const getCurrentDateTime = () => {
    return new Date().toISOString();
};
exports.getCurrentDateTime = getCurrentDateTime;
const isValidDate = (date) => {
    return !isNaN(new Date(date).getTime());
};
exports.isValidDate = isValidDate;
// String utilities
const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
exports.capitalize = capitalize;
const formatName = (firstName, lastName) => {
    return `${(0, exports.capitalize)(firstName)} ${(0, exports.capitalize)(lastName)}`;
};
exports.formatName = formatName;
const formatSSN = (ssn) => {
    const cleaned = ssn.replace(/\D/g, '');
    if (cleaned.length === 9) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
    }
    return ssn;
};
exports.formatSSN = formatSSN;
const formatPhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
};
exports.formatPhoneNumber = formatPhoneNumber;
const maskSSN = (ssn) => {
    const formatted = (0, exports.formatSSN)(ssn);
    if (formatted.length === 11) { // XXX-XX-XXXX format
        return `***-**-${formatted.slice(7)}`;
    }
    return ssn;
};
exports.maskSSN = maskSSN;
// Validation utilities
const validateEmail = (email) => {
    return constants_1.VALIDATION_RULES.EMAIL.PATTERN.test(email);
};
exports.validateEmail = validateEmail;
const validatePhone = (phone) => {
    return constants_1.VALIDATION_RULES.PHONE.PATTERN.test(phone);
};
exports.validatePhone = validatePhone;
const validateSSN = (ssn) => {
    return constants_1.VALIDATION_RULES.SSN.PATTERN.test(ssn);
};
exports.validateSSN = validateSSN;
const validateZipCode = (zipCode) => {
    return constants_1.VALIDATION_RULES.ZIP_CODE.PATTERN.test(zipCode);
};
exports.validateZipCode = validateZipCode;
const validatePassword = (password) => {
    const errors = [];
    const rules = constants_1.VALIDATION_RULES.PASSWORD;
    if (password.length < rules.MIN_LENGTH) {
        errors.push({
            field: 'password',
            message: `Password must be at least ${rules.MIN_LENGTH} characters long`,
        });
    }
    if (rules.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
        errors.push({
            field: 'password',
            message: 'Password must contain at least one uppercase letter',
        });
    }
    if (rules.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
        errors.push({
            field: 'password',
            message: 'Password must contain at least one lowercase letter',
        });
    }
    if (rules.REQUIRE_NUMBERS && !/\d/.test(password)) {
        errors.push({
            field: 'password',
            message: 'Password must contain at least one number',
        });
    }
    if (rules.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push({
            field: 'password',
            message: 'Password must contain at least one special character',
        });
    }
    return errors;
};
exports.validatePassword = validatePassword;
// Medical utilities
const calculateAge = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};
exports.calculateAge = calculateAge;
const formatVitalSigns = (systolic, diastolic) => {
    return `${systolic}/${diastolic}`;
};
exports.formatVitalSigns = formatVitalSigns;
const getPainDescription = (scale) => {
    const descriptions = [
        'No pain',
        'Mild pain',
        'Mild pain',
        'Moderate pain',
        'Moderate pain',
        'Moderate pain',
        'Severe pain',
        'Severe pain',
        'Very severe pain',
        'Very severe pain',
        'Worst possible pain',
    ];
    return descriptions[Math.max(0, Math.min(10, Math.floor(scale)))];
};
exports.getPainDescription = getPainDescription;
// Array utilities
const groupBy = (array, key) => {
    return array.reduce((result, item) => {
        const group = String(item[key]);
        if (!result[group]) {
            result[group] = [];
        }
        result[group].push(item);
        return result;
    }, {});
};
exports.groupBy = groupBy;
const sortBy = (array, key, direction = 'asc') => {
    return [...array].sort((a, b) => {
        const aValue = a[key];
        const bValue = b[key];
        if (aValue < bValue)
            return direction === 'asc' ? -1 : 1;
        if (aValue > bValue)
            return direction === 'asc' ? 1 : -1;
        return 0;
    });
};
exports.sortBy = sortBy;
// Object utilities
const omit = (obj, keys) => {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
};
exports.omit = omit;
const pick = (obj, keys) => {
    const result = {};
    keys.forEach(key => {
        if (key in obj) {
            result[key] = obj[key];
        }
    });
    return result;
};
exports.pick = pick;
// Storage utilities (for localStorage/sessionStorage)
exports.storage = {
    get: (key) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        }
        catch {
            return null;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        }
        catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    },
    remove: (key) => {
        try {
            localStorage.removeItem(key);
        }
        catch (error) {
            console.error('Failed to remove from localStorage:', error);
        }
    },
};
// Debounce utility
const debounce = (func, wait) => {
    let timeout = null;
    return (...args) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), wait);
    };
};
exports.debounce = debounce;
// Generate unique IDs
const generateId = () => {
    return crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15);
};
exports.generateId = generateId;
// Error handling
const handleError = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'An unknown error occurred';
};
exports.handleError = handleError;
//# sourceMappingURL=index.js.map