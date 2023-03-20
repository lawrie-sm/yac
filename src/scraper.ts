export async function callWikipedia(query: string) {
  /*
https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=%22french%22
  */
  // fetch data from wikipedia
  const params = {
    action: "query",
    list: "search",
    format: "json",
    srsearch: query,
  };
  const url = "https://en.wikipedia.org/w/api.php?" +
    (new URLSearchParams(params)).toString();
  const response = await fetch(url);
  const data = await response.json();
  const firstResultString = data.query.search[0].snippet;
  return firstResultString;
}
