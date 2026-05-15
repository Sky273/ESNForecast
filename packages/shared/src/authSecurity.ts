export type PasswordRuleKey = "minLength" | "uppercase" | "lowercase" | "digit" | "special";

export type PasswordRuleResult = {
  key: PasswordRuleKey;
  label: string;
  valid: boolean;
};

export type PasswordValidationResult = {
  valid: boolean;
  rules: PasswordRuleResult[];
};

export type SecurityContextLevel = "secure" | "local_http" | "development_http" | "insecure_http";

export type SecurityContextInput = {
  protocol: string;
  hostname: string;
  mode?: string;
};

export type SecurityContextResult = {
  level: SecurityContextLevel;
  secure: boolean;
  blocking: boolean;
  message?: string;
};

export function validatePasswordRules(password: string): PasswordValidationResult {
  const rules: PasswordRuleResult[] = [
    { key: "minLength", label: "12 caracteres minimum", valid: password.length >= 12 },
    { key: "uppercase", label: "Au moins une majuscule", valid: /[A-Z]/.test(password) },
    { key: "lowercase", label: "Au moins une minuscule", valid: /[a-z]/.test(password) },
    { key: "digit", label: "Au moins un chiffre", valid: /\d/.test(password) },
    { key: "special", label: "Au moins un caractere special", valid: /[^A-Za-z0-9]/.test(password) }
  ];

  return {
    valid: rules.every((rule) => rule.valid),
    rules
  };
}

export function assessSecurityContext(input: SecurityContextInput): SecurityContextResult {
  const hostname = input.hostname.toLowerCase();
  const mode = input.mode ?? "production";
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  if (input.protocol === "https:") {
    return { level: "secure", secure: true, blocking: false };
  }

  if (isLocal) {
    return {
      level: "local_http",
      secure: false,
      blocking: false,
      message: "Environnement local detecte : connexion HTTP autorisee pour le developpement."
    };
  }

  if (mode !== "production") {
    return {
      level: "development_http",
      secure: false,
      blocking: false,
      message: "Environnement de developpement : utilisez HTTPS pour les tests exposes sur internet."
    };
  }

  return {
    level: "insecure_http",
    secure: false,
    blocking: false,
    message: "Attention : cette connexion n'est pas chiffree. Utilisez HTTPS pour proteger les identifiants."
  };
}
