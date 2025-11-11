document.addEventListener("DOMContentLoaded", async () => {
  const hashList = document.getElementById("hash-list");
  const merkleRootEl = document.getElementById("merkle-root");
  const archiveBtn = document.getElementById("archive-btn");
  const resultEl = document.getElementById("result");

  let merkleRoot = null;

  // 🔹 Step 1: Fetch and display hashes + Merkle root
  async function loadHashesAndMerkle() {
    try {
      const res = await fetch("/generate-merkle");
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load CSV hashes");

      // Show hashes
      hashList.innerHTML = "";
      data.hashes.forEach((hash) => {
        const li = document.createElement("li");
        li.textContent = hash;
        hashList.appendChild(li);
      });

      // Show Merkle root
      merkleRoot = data.merkleRoot;
      merkleRootEl.textContent = merkleRoot;
    } catch (err) {
      console.error(err);
      hashList.innerHTML = `<li class="text-red-400">Error: ${err.message}</li>`;
    }
  }

  await loadHashesAndMerkle();

  // 🔹 Step 2: Archive Merkle root on-chain
  archiveBtn.addEventListener("click", async () => {
    if (!merkleRoot) {
      resultEl.textContent = "❌ No Merkle root found!";
      return;
    }

    resultEl.textContent = "⏳ Archiving on-chain...";

    try {
      const response = await fetch("/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archive_hash: merkleRoot,
          timestamp: Date.now(),
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Archive failed");

      resultEl.innerHTML = `
        ✅ <strong>Archive successful!</strong><br>
        <strong>Tx Hash:</strong> ${data.txHash}<br>
        <strong>Metadata:</strong> <pre>${JSON.stringify(data.metadata, null, 2)}</pre>
      `;

      checkTxStatus(data.txHash);

      // 🔹 Simple polling function to check if tx is confirmed
      async function checkTxStatus(txHash) {
        const interval = setInterval(async () => {
          try {
            const res = await fetch(`http://localhost:8080/api/v1/txs/${txHash}`);
            if (res.ok) {
              const txData = await res.json();
              if (txData?.tx) {
                clearInterval(interval);
                resultEl.innerHTML += `<br>✅ <strong>Transaction confirmed on-chain!</strong>`;
              }
            }
          } catch (err) {
            // Ignore errors until it confirms
          }
        }, 3000); // check every 3 seconds
      }


    } catch (err) {
      console.error(err);
      resultEl.innerHTML = `❌ Error: ${err.message}`;
    }
  });
});
