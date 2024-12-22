
import { Router } from "express";
import { auth } from "express-openid-connect";
import client from "@metaSpace/db";
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
userRouter.post('/callback', async (req, res) => {
  const { id, username, profilePicture, email, role } = req.body;

  try {
    // Check if the user already exists in the database
    const existingUser = await client.user.findUnique({
      where: { id },
    });

    if (existingUser) {
      console.log('User already exists in the database:', existingUser);
      res.status(400).send('User already exists');
      return;
    }

    // Create a new user record
    const newUser = await client.user.create({
      data: {
        id,
        username,
        profilePicture,
        email,
        role,
      },
    });

    console.log('User created successfully:', newUser);

    // Send success response
    res.status(201).send('User created successfully');
  } catch (error) {
    console.error('Error saving user data to database:', error);
    res.status(500).send('Internal Server Error');
  }});

// Protected route for user profile
/*userRouter.get('/profile', requiresAuth(), (req, res) => {
  res.json(req.oidc.user);
});*/

export default userRouter;


