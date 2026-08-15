async function test() {
  console.log("=== Testing All Sync Pages Redirects ===");
  const pages = [
    { name: 'squad', url: 'https://www.battrick.org/nl/squad.asp' },
    { name: 'nets', url: 'https://www.battrick.org/nl/nets.asp' },
    { name: 'finances', url: 'https://www.battrick.org/nl/finances.asp' },
    { name: 'club', url: 'https://www.battrick.org/nl/club.asp' },
    { name: 'fixtures', url: 'https://www.battrick.org/nl/fixtures.asp' },
    { name: 'pavilion', url: 'https://www.battrick.org/nl/ground.asp' }
  ];

  for (const page of pages) {
    try {
      const res = await fetch(page.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        redirect: 'manual'
      });
      console.log(`Page: ${page.name} (${page.url}) -> Status: ${res.status} ${res.statusText}`);
      console.log(`Location: ${res.headers.get('location')}`);
    } catch (err) {
      console.error(`Error fetching ${page.name}:`, err);
    }
  }
}

test();
