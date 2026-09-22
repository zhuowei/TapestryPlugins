const firebaseConfig = {
  apiKey: "AIzaSyCo71AzF6roAoY7wd-nFqA5vChij-yhIQs",
  authDomain: "prod-bluebird.firebaseapp.com",
  projectId: "prod-bluebird",
  appId: "1:164490752597:web:2933c4b39fdcce5baa9adc",
  messagingSenderId: "164490752597",
  storageBucket: "prod-bluebird.firebasestorage.app",
  appCheckSiteKey: "6LcnW6gtAAAAANCw4H7aofTf4Grx9EE5GjZqaaXt",
};

const API_BASE = "https://api.tweet.app";
const SITE_BASE = "https://app.tweet.app";

async function doLogin() {
  const loginResponse = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword",
    {
      method: "POST",
      headers: {
        referer: SITE_BASE,
      },
      params: {
        key: firebaseConfig.apiKey,
      },
      json: {
        email: accountEmail,
        password: accountPassword,
        returnSecureToken: true,
      },
    },
  ).json();
  setItem("idToken", loginResponse.idToken);
  setItem("refreshToken", loginResponse.refreshToken);
  setItem("expiryDate", Date.now() + Number(loginResponse.expires_in) * 1000);
  return loginResponse;
}

async function verify() {
  const loginResponse = doLogin();
  const username = loginResponse.localId;
  return {
    identity: {
      name: username,
      username: "@" + username,
      uri: `${SITE_BASE}/user/${username}`,
    },
  };
}

async function getAuthToken() {
  if (!getItem("refreshToken")) {
    await doLogin();
  }
  if (Date.now() + 60 * 1000 < getItem("expiryDate")) {
    return "Bearer " + getItem("idToken");
  }
  const refreshResponse = await fetch(
    "https://securetoken.googleapis.com/v1/token",
    {
      method: "POST",
      headers: {
        referer: SITE_BASE,
      },
      params: {
        key: firebaseConfig.apiKey,
      },
      form: {
        grant_type: "refresh_token",
        refresh_token: getItem("refreshToken"),
      },
    },
  ).json();
  setItem("idToken", refreshResponse.id_token);
  setItem("refreshToken", refreshResponse.refresh_token);
  setItem("expiryDate", Date.now() + Number(refreshResponse.expires_in) * 1000);
  // TODO(zhuowei)
  return "Bearer " + getItem("idToken");
}

async function load() {
  const authHeader = await getAuthToken();
  // For You
  const response = await fetch(API_BASE + "/api/posts", {
    headers: {
      authorization: authHeader,
    },
  }).json();
  return response.posts.map((p) => ({
    uri: `${SITE_BASE}/post/${p.id}`,
    date: new Date(p.createdAt),
    body: p.text.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    author: {
      name: p.authorName,
      username: `@${p.authorUsername}`,
      uri: `${SITE_BASE}/user/${p.authorUsername}`,
      avatar: p.authorAvatar,
    },
  }));
}
