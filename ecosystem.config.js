module.exports = {
  apps: [
    {
      name: "social-ai-backend",
      cwd: "/var/www/social-ai/social-ai",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "development",
        PORT: 4001
      }
    },
   {
     name: "social-ai-frontend",
     cwd: "/var/www/social-ai/social-ai",
     script: "npm",
     args: "run dev:client -- --host 0.0.0.0",
     env: {
       NODE_ENV: "development",
       PORT: 5173
     }
   }
  ]
};
