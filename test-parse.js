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
console.log(activeTab);
const ths = doc.querySelectorAll('th');
ths.forEach(th => {
  if(th.textContent.trim() === 'Career') {
    const row = th.parentElement;
    const tds = row.querySelectorAll('td');
    console.log("Career row TDs:", tds.length);
    if(tds.length >= 3 && tds.length > 5) {
      console.log("Batting: Matches=", tds[0].textContent, "Runs=", tds[2].textContent);
    } else if (tds.length >= 1) {
      console.log("Bowling: Overs=", tds[0].textContent);
    }
  }
});
