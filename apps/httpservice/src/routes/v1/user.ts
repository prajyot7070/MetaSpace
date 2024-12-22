
import { Router } from "express";
import { auth } from "express-openid-connect";
const userRouter = Router();
const { requiresAuth } = require('express-openid-connect');

/*
const config = {
  authRequired: false,
  auth0Logout: true,
  baseURL: 'http://localhost:3000/',
  clientID: 'RZiCqF7kp0bdLOJe4tek033GoSnmYXPt',
  issuerBaseURL: 'https://dev-a1jxmtjamisacs8d.us.auth0.com',
  secret: 'LONG_RANDOM_STRING',
  routes: {
    callback: '/api/v1/user/callback',
    postLogoutRedirect: 'http://localhost:5173'
  }
};
userRouter.use(auth(config));
*/

/*
// Login endpoint (redirects to Auth0 login page)
userRouter.get('/login', (req, res) => {
  res.oidc.login();
});

// Updated logout endpoint
userRouter.get('/logout', (req, res) => {
  res.oidc.logout();
});
*/
// Callback endpoint (after login)
userRouter.post('/callback', (req, res) => {
  res.redirect(301,'http://localhost:5173/dashboard');
});
// Protected route for user profile
/*userRouter.get('/profile', requiresAuth(), (req, res) => {
  res.json(req.oidc.user);
});*/
export default userRouter;


