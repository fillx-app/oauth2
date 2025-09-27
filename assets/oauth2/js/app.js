new Vue({
  el: "#app",
  data() {
    return {
      clientId: sessionStorage.getItem("g_client_id") || "",
      clientSecret: sessionStorage.getItem("g_client_secret") || "",
      scopes:
        sessionStorage.getItem("g_scopes") ||
        "https://www.googleapis.com/auth/drive",
      loading: false,
      tokenData: null,
      expiresAtStr: "",
      statusMessage: "Idle",
    };
  },
  created() {
    this.checkForCode();
  },
  methods: {
    buildAuthUrl(clientId, redirect, scopes) {
      const base = "https://accounts.google.com/o/oauth2/v2/auth";
      const params = new URLSearchParams();
      params.set("client_id", clientId);
      params.set("redirect_uri", redirect);
      params.set("response_type", "code");
      params.set("scope", scopes);
      params.set("access_type", "offline");
      params.set("prompt", "consent");
      return base + "?" + params.toString();
    },

    generate() {
      if (!this.clientId || !this.clientSecret) {
        Swal.fire({
          icon: "warning",
          title: "Missing values",
          text: "Please provide both Client ID and Client Secret.",
        });
        return;
      }

      const redirect = window.location.origin + window.location.pathname; // same page
      // store temporarily
      sessionStorage.setItem("g_client_id", this.clientId);
      sessionStorage.setItem("g_client_secret", this.clientSecret);
      sessionStorage.setItem("g_scopes", this.scopes);

      const url = this.buildAuthUrl(this.clientId, redirect, this.scopes);
      this.statusMessage = "Redirecting to Google for consent...";

      // full redirect in same tab
      window.location.href = url;
    },

    async checkForCode() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");

      if (error) {
        this.statusMessage = "OAuth error";
        Swal.fire({ icon: "error", title: "OAuth Error", text: error });
        return;
      }

      if (!code) return;

      this.statusMessage = "Authorization code received. Exchanging...";
      // retrieve credentials from session
      const clientId = sessionStorage.getItem("g_client_id");
      const clientSecret = sessionStorage.getItem("g_client_secret");
      const scopes = sessionStorage.getItem("g_scopes") || this.scopes;

      if (!clientId || !clientSecret) {
        Swal.fire({
          icon: "error",
          title: "Missing credentials",
          text: "Client ID/Secret not found in session. Please start the flow again.",
        });
        return;
      }

      try {
        this.loading = true;
        const body = new URLSearchParams();
        body.set("code", code);
        body.set("client_id", clientId);
        body.set("client_secret", clientSecret);
        body.set(
          "redirect_uri",
          window.location.origin + window.location.pathname
        );
        body.set("grant_type", "authorization_code");

        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        const data = await res.json();
        this.loading = false;

        if (!res.ok || data.error) {
          const msg = data.error_description || data.error || "Unknown error";
          this.statusMessage = "Exchange failed";
          Swal.fire({
            icon: "error",
            title: "Token Exchange Failed",
            text: msg,
          });
          return;
        }

        this.tokenData = data;
        const expiresIn = data.expires_in || 0;
        const expiresAt = new Date(Date.now() + expiresIn * 1000);
        this.expiresAtStr = this.formatDate(expiresAt);
        this.statusMessage = "Tokens obtained";

        // check scope includes drive
        if (
          !(data.scope || "").includes("https://www.googleapis.com/auth/drive")
        ) {
          Swal.fire({
            icon: "warning",
            title: "Scope Notice",
            text: "Returned scope does not include full Google Drive scope you requested.",
          });
        }
        setTimeout(() => {
          const qrcodeContainer = document.getElementById("qrcode");
          const url = `https://fill-x.web.app?client_id=${this.clientId}&client_secret=${this.clientSecret}&refresh_token=${this.tokenData.refresh_token}`; // data QR code

          new QRCode(qrcodeContainer, {
            text: url,
            width: 180,
            height: 180,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H,
          });
        }, 300);
        Swal.fire({
          icon: "success",
          title: "Token Obtained",
          html: `Access token and refresh token obtained.`,
        });

        // clean querystring to avoid re-exchanging on reload
        if (window.history && window.history.replaceState) {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } catch (e) {
        this.loading = false;
        this.statusMessage = "Exchange failed";
        Swal.fire({
          icon: "error",
          title: "Request Error",
          text: (e && e.message) || "Network error",
        });
      }
    },

    formatDate(d) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(
        d.getMonth() + 1
      )}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
        d.getSeconds()
      )}`;
    },

    copy(text) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        M.toast({ html: "Copied to clipboard" });
      });
    },

    downloadJson() {
      if (!this.tokenData) return;
      const data = Object.assign({}, this.tokenData, {
        obtained_at: new Date().toISOString(),
        expires_at: this.expiresAtStr,
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "google_oauth_tokens.json";
      a.click();
      URL.revokeObjectURL(url);
    },

    clearTokens() {
      this.tokenData = null;
      this.expiresAtStr = "";
      Swal.fire({
        icon: "info",
        title: "Cleared",
        text: "Token data cleared from page.",
      });
    },

    clearSession() {
      sessionStorage.removeItem("g_client_id");
      sessionStorage.removeItem("g_client_secret");
      sessionStorage.removeItem("g_scopes");
      this.clientId = "";
      this.clientSecret = "";
      this.statusMessage = "Session cleared";
      Swal.fire({
        icon: "success",
        title: "Session Cleared",
        text: "Temporary credentials removed from sessionStorage.",
      });
    },
  },
});
