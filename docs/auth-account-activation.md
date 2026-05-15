# Activation des comptes utilisateur

La creation d'un utilisateur envoie un email d'activation contenant un lien `#/first-login?token=...`.
Les nouveaux comptes n'ont pas de mot de passe tant que ce lien n'a pas ete utilise.

Variables SMTP cote API :

```env
APP_PUBLIC_URL=https://votre-url-app
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="ESN Forecast <no-reply@example.com>"
ACCOUNT_ACTIVATION_TTL_HOURS=72
```

Sans `SMTP_HOST`, l'API n'envoie pas d'email et affiche le lien d'activation dans les logs de developpement.
