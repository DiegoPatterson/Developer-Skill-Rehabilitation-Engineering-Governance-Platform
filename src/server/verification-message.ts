export function verificationMessage(origin: string, token: string): { subject: string; text: string } {
  const link = `${origin}/verify?token=${encodeURIComponent(token)}`;
  return {
    subject: "Confirm your Skill Governance account",
    text: [
      "Confirm your email to finish creating your Skill Governance account.",
      "",
      link,
      "",
      "This link lasts 24 hours. After you open it, sign in.",
      "This message is sent from strayapps.co@gmail.com.",
      "If you did not create an account, you can ignore it.",
    ].join("\n"),
  };
}
