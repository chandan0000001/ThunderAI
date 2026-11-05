let cachedEmails = null;
let cachedSet = null;

const refreshCache = () => {
    const raw = [
        process.env.ADMIN_EMAILS,
        process.env.ADMIN_EMAIL
    ].filter(Boolean).join(",");

    cachedEmails = raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    cachedSet = new Set(cachedEmails);
};

export const getAdminEmails = () => {
    if (!cachedEmails) refreshCache();
    return cachedEmails;
};

export const isAdminEmail = (email) => {
    if (!email) return false;
    if (!cachedSet) refreshCache();
    return cachedSet.has(email.trim().toLowerCase());
};
