const { JSDOM } = require("jsdom");
const html = `
<ul class="tabs">
  <li id="tab1" class="selected"><a class="norm" title="Domestic One Day Matches" href="playerdetails.asp?statview=1&amp;playerID=5880978">OD</a></li>
  <li id="tab8"><a class="norm" title="Domestic BT20 Matches" href="playerdetails.asp?statview=8&amp;playerID=5880978">BT20</a></li>
</ul>
<table class="playerstats rtable">
  <tr class="aligncenter">
    <th class="alignleft">Career</th>
    <td>102</td>
    <td>74</td>
    <td>3239</td>
  </tr>
</table>
<table class="playerstats rtable">
  <tr class="aligncenter">
    <th class="alignleft">Career</th>
    <td>250</td>
    <td>0</td>
  </tr>
</table>
`;
const dom = new JSDOM(html);
const doc = dom.window.document;

const activeTab = doc.querySelector('.tabs .selected a')?.textContent;
console.log("Active Tab:", activeTab);
const ths = doc.querySelectorAll('th');
let matches = 0, runs = 0, overs = 0;
ths.forEach(th => {
  if(th.textContent.trim() === 'Career') {
    const row = th.parentElement;
    const tds = row.querySelectorAll('td');
    // Batting career row has many tds (usually 11: M I R n.o. Ave SR HS C st 50s 100s)
    // Actually the TH is "Career", then TDs.
    // If we count TDs... batting has 11, bowling has 9
    console.log("TDs length:", tds.length);
    if(tds.length >= 11) {
      matches = parseInt(tds[0].textContent, 10);
      runs = parseInt(tds[2].textContent, 10);
    } else if (tds.length >= 9 || (tds.length < 11 && tds.length > 0)) {
      overs = parseInt(tds[0].textContent, 10);
    }
  }
});
console.log({matches, runs, overs});
