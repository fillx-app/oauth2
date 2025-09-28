class GDrive {
  constructor() {
    this.apiBase = "https://www.googleapis.com/drive/v3";
    this.uploadBase = "https://www.googleapis.com/upload/drive/v3";
    this.fileName = "access-token-fillx.json";
  }

  // Cari file
  findFile(accessToken) {
    const query = encodeURIComponent(
      `name='${this.fileName}' and 'root' in parents`
    );
    return $.ajax({
      url: `${this.apiBase}/files?q=${query}&fields=files(id,name)`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((res) => (res.files && res.files.length > 0 ? res.files[0] : null));
  }

  // Upload atau update
  uploadOrUpdate(accessToken, content) {
    return this.findFile(accessToken).then((file) => {
      const buffer = JSON.stringify(content);

      if (file) {
        // update
        return $.ajax({
          url: `${this.uploadBase}/files/${file.id}?uploadType=media`,
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          data: buffer,
        }).then(() => file.id);
      } else {
        // create baru
        const metadata = {
          name: this.fileName,
          mimeType: "application/json",
          parents: ["root"],
        };

        const boundary = "foo_bar_baz";
        const body =
          `--${boundary}\r\n` +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          `\r\n--${boundary}\r\n` +
          "Content-Type: application/json\r\n\r\n" +
          buffer +
          `\r\n--${boundary}--`;

        return $.ajax({
          url: `${this.uploadBase}/files?uploadType=multipart&fields=id`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          data: body,
          processData: false,
        }).then((res) => res.id);
      }
    });
  }

  // Set permission hanya ke email tertentu
  setPermission(accessToken, fileId, email) {
    return $.ajax({
      url: `${this.apiBase}/files/${fileId}/permissions`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        role: "reader",
        type: "user",
        emailAddress: email,
      }),
    });
  }

  // Ambil isi file JSON
  getFile(accessToken, fileId) {
    return $.ajax({
      url: `${this.apiBase}/files/${fileId}?alt=media`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  deleteByName(accessToken, name = this.fileName) {
    return this.findFile(accessToken, name).then((file) => {
      if (!file) {
        return null;
      }
      return $.ajax({
        url: `${this.apiBase}/files/${file.id}`,
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then(() => file.id) // kembalikan id yang terhapus
        .catch((err) => {
          // lempar error supaya caller bisa tangani
          throw err;
        });
    });
  }
}
