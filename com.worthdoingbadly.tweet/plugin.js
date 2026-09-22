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
  let loginResponse = await fetch(
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
  if (loginResponse.mfaPendingCredential) {
    if (!accountTwoFactor) {
      throw new Error("You have two-factor turned on - enter the code");
    }
    response2 = await fetch(
      "https://identitytoolkit.googleapis.com/v2/accounts/mfaSignIn:finalize",
      {
        method: "POST",
        headers: {
          referer: SITE_BASE,
        },
        params: {
          key: firebaseConfig.apiKey,
        },
        json: {
          mfaPendingCredential: loginResponse.mfaPendingCredential,
          mfaEnrollmentId: loginResponse.mfaInfo[0].mfaEnrollmentId,
          totpVerificationInfo: {
            verificationCode: accountTwoFactor,
          },
        },
      },
    ).json();
    loginResponse = response2;
  }
  setItem("email", loginResponse.email);
  setItem("idToken", loginResponse.idToken);
  setItem("refreshToken", loginResponse.refreshToken);
  setItem("expiryDate", Date.now() + Number(loginResponse.expires_in) * 1000);
  setItem("username", loginResponse.localId);
  return loginResponse;
}

async function verify() {
  if (accountEmail !== getItem("email") || !getItem("refreshToken")) {
    await doLogin();
  }
  const username = getItem("username");
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

  const tasks = [];

  if (includeFeed == "on") {
    tasks.push(
      (async () => {
        const response = await fetch(API_BASE + "/api/posts", {
          headers: {
            authorization: authHeader,
          },
        }).json();
        processResults(response.posts.map(tweetAppPostToTapestry));
      })(),
    );
  }

  if (includeMentions == "on") {
    tasks.push(
      (async () => {
        const response = await fetch(API_BASE + "/api/notifications", {
          headers: {
            authorization: authHeader,
          },
        }).json();
        processResults(
          response.notifications
            .filter((p) => p.type === "mention")
            .map(tweetAppNotificationToTapestry),
        );
      })(),
    );
  }
  await Promise.all(tasks);
}

function tweetAppPostToTapestry(p) {
  return {
    uri: `${SITE_BASE}/post/${p.id}`,
    date: new Date(p.createdAt),
    body: p.text.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    author: {
      name: p.authorName,
      username: `@${p.authorUsername}`,
      uri: `${SITE_BASE}/user/${p.authorUsername}`,
      avatar: p.authorAvatar,
    },
  };
}

function tweetAppNotificationToTapestry(p) {
  return {
    uri: `${SITE_BASE}/post/${p.postId}`,
    date: new Date(p.createdAt),
    body: p.preview.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    author: {
      name: p.actorDisplayName,
      username: `@${p.actorHandle}`,
      uri: `${SITE_BASE}/user/${p.actorHandle}`,
      avatar: p.actorAvatarUrl,
    },
  };
}
