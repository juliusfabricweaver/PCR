export declare const APP_CONFIG: {
    readonly NAME: "PCR Application";
    readonly VERSION: "1.0.0";
    readonly DESCRIPTION: "Patient Care Report Management System";
};
export declare const API_ENDPOINTS: {
    readonly AUTH: {
        readonly LOGIN: "/api/auth/login";
        readonly LOGOUT: "/api/auth/logout";
        readonly REFRESH: "/api/auth/refresh";
        readonly PROFILE: "/api/auth/profile";
    };
    readonly PATIENTS: {
        readonly BASE: "/api/patients";
        readonly BY_ID: (id: string) => string;
        readonly SEARCH: "/api/patients/search";
    };
    readonly PCR: {
        readonly BASE: "/api/pcr";
        readonly BY_ID: (id: string) => string;
        readonly BY_PATIENT: (patientId: string) => string;
        readonly EXPORT_PDF: (id: string) => string;
    };
    readonly USERS: {
        readonly BASE: "/api/users";
        readonly BY_ID: (id: string) => string;
    };
};
export declare const ROUTES: {
    readonly HOME: "/";
    readonly LOGIN: "/login";
    readonly DASHBOARD: "/dashboard";
    readonly PATIENTS: "/patients";
    readonly PATIENT_DETAIL: "/patients/:id";
    readonly PCR: "/pcr";
    readonly PCR_NEW: "/pcr/new";
    readonly PCR_EDIT: "/pcr/:id/edit";
    readonly PCR_VIEW: "/pcr/:id";
    readonly REPORTS: "/reports";
    readonly SETTINGS: "/settings";
    readonly PROFILE: "/profile";
};
export declare const STORAGE_KEYS: {
    readonly AUTH_TOKEN: "pcr_auth_token";
    readonly USER_PREFERENCES: "pcr_user_preferences";
    readonly DRAFT_PCR: "pcr_draft_";
    readonly THEME: "pcr_theme";
};
export declare const VALIDATION_RULES: {
    readonly PASSWORD: {
        readonly MIN_LENGTH: 8;
        readonly REQUIRE_UPPERCASE: true;
        readonly REQUIRE_LOWERCASE: true;
        readonly REQUIRE_NUMBERS: true;
        readonly REQUIRE_SPECIAL_CHARS: true;
    };
    readonly SSN: {
        readonly PATTERN: RegExp;
    };
    readonly PHONE: {
        readonly PATTERN: RegExp;
    };
    readonly EMAIL: {
        readonly PATTERN: RegExp;
    };
    readonly ZIP_CODE: {
        readonly PATTERN: RegExp;
    };
};
export declare const MEDICAL_CONSTANTS: {
    readonly VITAL_SIGNS: {
        readonly BLOOD_PRESSURE: {
            readonly NORMAL_SYSTOLIC: {
                readonly min: 90;
                readonly max: 120;
            };
            readonly NORMAL_DIASTOLIC: {
                readonly min: 60;
                readonly max: 80;
            };
        };
        readonly HEART_RATE: {
            readonly NORMAL_ADULT: {
                readonly min: 60;
                readonly max: 100;
            };
        };
        readonly RESPIRATORY_RATE: {
            readonly NORMAL_ADULT: {
                readonly min: 12;
                readonly max: 20;
            };
        };
        readonly TEMPERATURE: {
            readonly NORMAL_FAHRENHEIT: {
                readonly min: 97;
                readonly max: 99.5;
            };
            readonly NORMAL_CELSIUS: {
                readonly min: 36.1;
                readonly max: 37.5;
            };
        };
        readonly OXYGEN_SATURATION: {
            readonly NORMAL: {
                readonly min: 95;
                readonly max: 100;
            };
        };
    };
    readonly PAIN_SCALE: {
        readonly MIN: 0;
        readonly MAX: 10;
        readonly DESCRIPTIONS: readonly ["No pain", "Mild pain", "Mild pain", "Moderate pain", "Moderate pain", "Moderate pain", "Severe pain", "Severe pain", "Very severe pain", "Very severe pain", "Worst possible pain"];
    };
};
export declare const ROLES: {
    readonly EMT: "emt";
    readonly PARAMEDIC: "paramedic";
    readonly SUPERVISOR: "supervisor";
    readonly ADMIN: "admin";
};
export declare const PERMISSIONS: {
    readonly emt: readonly ["read_pcr", "create_pcr", "update_own_pcr"];
    readonly paramedic: readonly ["read_pcr", "create_pcr", "update_pcr", "administer_medications"];
    readonly supervisor: readonly ["read_pcr", "create_pcr", "update_pcr", "delete_pcr", "approve_pcr"];
    readonly admin: readonly ["all"];
};
export declare const ERROR_MESSAGES: {
    readonly GENERIC: "An unexpected error occurred. Please try again.";
    readonly NETWORK: "Network error. Please check your connection.";
    readonly UNAUTHORIZED: "You are not authorized to perform this action.";
    readonly VALIDATION: "Please check your input and try again.";
    readonly NOT_FOUND: "The requested resource was not found.";
    readonly SERVER_ERROR: "Server error. Please try again later.";
    readonly SESSION_EXPIRED: "Your session has expired. Please log in again.";
};
export declare const SUCCESS_MESSAGES: {
    readonly PCR_SAVED: "PCR saved successfully";
    readonly PCR_SUBMITTED: "PCR submitted successfully";
    readonly PATIENT_SAVED: "Patient information saved successfully";
    readonly LOGIN_SUCCESS: "Login successful";
    readonly LOGOUT_SUCCESS: "Logged out successfully";
    readonly PROFILE_UPDATED: "Profile updated successfully";
};
//# sourceMappingURL=index.d.ts.map