
import { Router } from "express";
import { auth } from "express-openid-connect";
const userRouter = Router();
const { requiresAuth } = require('express-openid-connect');


const config = {
  authRequired: false,
  auth0Logout: true,
  baseURL: 'http://localhost:3000/api/v1/user',
  clientID: 'RZiCqF7kp0bdLOJe4tek033GoSnmYXPt',
  issuerBaseURL: 'https://dev-a1jxmtjamisacs8d.us.auth0.com',
  secret: 'LONG_RANDOM_STRING'
};

userRouter.use(auth(config));

userRouter.get('/', requiresAuth(), (req, res) => {
   res.send(
    JSON.stringify(req.oidc.user)
    //req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out'
  ) 
});

// Get user profile
userRouter.get('/metadata', (req, res) => {
  // TODO: Authenticate user using JWT from headers
  const user = { username: "mock-user" }; // Replace with actual user data
  res.json(user);
});
export default userRouter;
