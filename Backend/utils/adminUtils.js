export const getAdminEmails = () => {
    const raw = [
        process.env.ADMIN_EMAILS,
        process.env.ADMIN_EMAIL
    ].filter(Boolean).join(",");

    return raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
};

export const isAdminEmail = (email) => {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    return getAdminEmails().includes(normalized);
};
