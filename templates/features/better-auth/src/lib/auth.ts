import { betterAuth } from "better-auth";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? "replace-me",
  emailAndPassword: {
    enabled: true
  }
});

export const handler = auth.handler;

export default handler;
