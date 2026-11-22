(function () {
  "use strict";

  var config = window.ALEXO_BACKEND_CONFIG || {};
  var client = window.supabase && typeof window.supabase.createClient === "function" &&
    config.supabaseUrl && config.supabaseAnonKey
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true
        }
      })
    : null;

  function requireClient() {
    if (!client) {
      throw new Error("Account sign-in is unavailable. Check the Supabase setup and reload this page.");
    }
    return client;
  }

  function throwIfError(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  function accountRedirectUrl() {
    return new URL("account.html", window.location.href).href;
  }

  function profileFromRow(row, user) {
    var metadata = user.user_metadata || {};
    return {
      firstName: row.first_name || metadata.first_name || "",
      lastName: row.last_name || metadata.last_name || "",
      email: user.email || "",
      phone: row.phone || "",
      avatar: "",
      accountCredit: 0
    };
  }

  function loadAccountData(user) {
    var supabaseClient = requireClient();
    return supabaseClient
      .from("customer_profiles")
      .select("user_id, first_name, last_name, phone, addresses")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(function (result) {
        var row = throwIfError(result);
        if (row) {
          return {
            profile: profileFromRow(row, user),
            addresses: Array.isArray(row.addresses) ? row.addresses : []
          };
        }

        var metadata = user.user_metadata || {};
        return supabaseClient
          .from("customer_profiles")
          .upsert({
            user_id: user.id,
            first_name: metadata.first_name || "",
            last_name: metadata.last_name || "",
            phone: "",
            addresses: []
          }, { onConflict: "user_id" })
          .select("user_id, first_name, last_name, phone, addresses")
          .single()
          .then(function (created) {
            var profileRow = throwIfError(created);
            return {
              profile: profileFromRow(profileRow, user),
              addresses: Array.isArray(profileRow.addresses) ? profileRow.addresses : []
            };
          });
      });
  }

  function saveCustomerData(user, values) {
    var supabaseClient = requireClient();
    return supabaseClient
      .from("customer_profiles")
      .upsert({
        user_id: user.id,
        first_name: values.firstName,
        last_name: values.lastName,
        phone: values.phone,
        addresses: values.addresses
      }, { onConflict: "user_id" })
      .select("user_id, first_name, last_name, phone, addresses")
      .single()
      .then(function (result) {
        return profileFromRow(throwIfError(result), user);
      });
  }

  var auth = {
    isConfigured: function () { return !!client; },
    getUser: function () {
      var supabaseClient = requireClient();
      return supabaseClient.auth.getSession().then(function (sessionResult) {
        if (sessionResult.error) throw sessionResult.error;
        if (!sessionResult.data.session) return null;
        return supabaseClient.auth.getUser().then(function (userResult) {
          if (userResult.error) throw userResult.error;
          return userResult.data.user;
        });
      });
    },
    signIn: function (email, password) {
      return requireClient().auth.signInWithPassword({ email: email, password: password })
        .then(function (result) {
          if (result.error) throw result.error;
          return result.data;
        });
    },
    signUp: function (email, password, firstName, lastName) {
      return requireClient().auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: accountRedirectUrl(),
          data: { first_name: firstName, last_name: lastName }
        }
      }).then(function (result) {
        if (result.error) throw result.error;
        return result.data.session;
      });
    },
    requestPasswordReset: function (email) {
      var redirectUrl = new URL("login.html?flow=recovery", window.location.href).href;
      return requireClient().auth.resetPasswordForEmail(email, { redirectTo: redirectUrl })
        .then(function (result) {
          if (result.error) throw result.error;
        });
    },
    updatePassword: function (password) {
      return requireClient().auth.updateUser({ password: password })
        .then(function (result) {
          if (result.error) throw result.error;
          return result.data.user;
        });
    },
    signOut: function () {
      return requireClient().auth.signOut().then(function (result) {
        if (result.error) throw result.error;
      });
    },
    loadAccountData: loadAccountData,
    saveProfile: function (user, profile, addresses) {
      return saveCustomerData(user, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        addresses: addresses
      });
    },
    saveAddresses: function (user, profile, addresses) {
      return saveCustomerData(user, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        addresses: addresses
      });
    }
  };

  window.ALEXO_Auth = auth;

  var signInForm = document.getElementById("signInForm");
  if (!signInForm) return;

  var signUpForm = document.getElementById("signUpForm");
  var resetForm = document.getElementById("resetForm");
  var recoveryForm = document.getElementById("recoveryForm");
  var tabSignIn = document.getElementById("tabSignIn");
  var tabSignUp = document.getElementById("tabSignUp");
  var forgotPassword = document.getElementById("forgotPassword");
  var backToSignIn = document.getElementById("backToSignIn");
  var message = document.getElementById("authMessage");
  var authTitle = document.getElementById("authTitle");
  var authIntro = document.getElementById("authIntro");
  var forms = [signInForm, signUpForm, resetForm, recoveryForm].filter(Boolean);

  function showMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("is-error", !!isError);
    message.classList.toggle("is-success", !isError);
  }

  function show(which) {
    var copy = {
      signin: ["Welcome back", "Sign in to continue to your account."],
      signup: ["Create your account", "Join ALEXO and keep your favorite pieces close."],
      reset: ["Reset your password", "Enter your email and we’ll send you a secure reset link."],
      recovery: ["Choose a new password", "Create a new password for your ALEXO account."]
    }[which];
    signInForm.hidden = which !== "signin";
    signUpForm.hidden = which !== "signup";
    if (resetForm) resetForm.hidden = which !== "reset";
    if (recoveryForm) recoveryForm.hidden = which !== "recovery";
    if (authTitle) authTitle.textContent = copy[0];
    if (authIntro) authIntro.textContent = copy[1];
    document.title = copy[0] + " — ALEXO";
    tabSignIn.setAttribute("aria-selected", String(which === "signin"));
    tabSignUp.setAttribute("aria-selected", String(which === "signup"));
    tabSignIn.hidden = which === "reset" || which === "recovery";
    tabSignUp.hidden = tabSignIn.hidden;
    message.textContent = "";
    message.classList.remove("is-error", "is-success");
  }

  function nextPage() {
    var next = new URLSearchParams(window.location.search).get("next") || "";
    return /^[a-z0-9-]+\.html$/i.test(next) ? next : "account.html";
  }

  function submitWithStatus(form, pendingMessage, action, success) {
    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage(pendingMessage, false);
    return action().then(function (result) {
      if (success) success(result);
    }).catch(function (error) {
      showMessage(error.message || "The request could not be completed. Please try again.", true);
      button.disabled = false;
    });
  }

  tabSignIn.addEventListener("click", function () { show("signin"); });
  tabSignUp.addEventListener("click", function () { show("signup"); });
  forgotPassword.addEventListener("click", function () { show("reset"); });
  backToSignIn.addEventListener("click", function () { show("signin"); });

  signInForm.addEventListener("submit", function (event) {
    event.preventDefault();
    submitWithStatus(signInForm, "Signing in…", function () {
      return auth.signIn(
        document.getElementById("siEmail").value.trim(),
        document.getElementById("siPassword").value
      );
    }, function () { window.location.assign(nextPage()); });
  });

  signUpForm.addEventListener("submit", function (event) {
    event.preventDefault();
    submitWithStatus(signUpForm, "Creating your account…", function () {
      return auth.signUp(
        document.getElementById("suEmail").value.trim(),
        document.getElementById("suPassword").value,
        document.getElementById("suFirst").value.trim(),
        document.getElementById("suLast").value.trim()
      );
    }, function (session) {
      if (session) {
        window.location.assign(nextPage());
      } else {
        showMessage("Account created. Check your email to confirm it, then sign in.", false);
        signUpForm.querySelector('button[type="submit"]').disabled = false;
      }
    });
  });

  resetForm.addEventListener("submit", function (event) {
    event.preventDefault();
    submitWithStatus(resetForm, "Sending password reset email…", function () {
      return auth.requestPasswordReset(document.getElementById("resetEmail").value.trim());
    }, function () {
      showMessage("If an account exists for that email, a password reset link has been sent.", false);
      resetForm.querySelector('button[type="submit"]').disabled = false;
    });
  });

  recoveryForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var password = document.getElementById("recoveryPassword").value;
    if (password !== document.getElementById("recoveryConfirm").value) {
      showMessage("The passwords do not match.", true);
      return;
    }
    submitWithStatus(recoveryForm, "Updating your password…", function () {
      return auth.updatePassword(password);
    }, function () {
      showMessage("Password updated. You can now sign in.", false);
      window.history.replaceState(null, "", "login.html");
      show("signin");
    });
  });

  if (!auth.isConfigured()) {
    forms.forEach(function (form) {
      var submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
    });
    showMessage("Sign-in is unavailable until Supabase is configured and the Supabase client can be loaded.", true);
    return;
  }

  if (new URLSearchParams(window.location.search).get("flow") === "recovery") {
    auth.getUser().then(function (user) {
      if (user) show("recovery");
      else showMessage("This password reset link is invalid or expired. Request a new one.", true);
    }).catch(function (error) {
      showMessage(error.message || "Could not verify the password reset link.", true);
    });
  } else if (window.location.hash === "#signup") {
    show("signup");
  }
})();
