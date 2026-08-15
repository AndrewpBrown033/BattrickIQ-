async function test() {
  console.log("=== Testing Squad with Empty BTUser Cookie ===");
  try {
    const res = await fetch('https://www.battrick.org/nl/squad.asp', {
      headers: {
        'Cookie': 'ASPSESSIONIDAURTSDTT=DKJHKMGCHOHICNPHNGACDLGO; BTUser=',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    console.log("Response URL:", res.url);
    console.log("Response Status:", res.status, res.statusText);
  } catch (err) {
    console.error("Error fetching squad:", err);
  }
}

test();
