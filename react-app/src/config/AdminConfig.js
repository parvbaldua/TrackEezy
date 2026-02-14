// Admin Configuration for TrackEezy
// Add email addresses here to grant admin access

export const ADMIN_CONFIG = {
    // List of email addresses with admin privileges
    adminEmails: [
        'parvbaldua@gmail.com'
    ],

    // App Name
    appName: 'AapKaBakaya',

    // Version
    version: '2.0.0'
};

// Helper function to check if user is admin
export const isAdminEmail = (email) => {
    if (!email) return false;
    return ADMIN_CONFIG.adminEmails.some(
        adminEmail => adminEmail.toLowerCase() === email.toLowerCase()
    );
};
