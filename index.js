import scrapers from './scrapers.js';
import * as fs from './lib/fs.js';
import path from 'path';
import csvStringify from 'csv-stringify';

/*
  Combine location information with the passed data object
*/
function addLocationToData(data, location) {
  Object.assign(data, location);

  for (let prop in data) {
    // Remove "private" fields
    if (prop[0] === '_') {
      delete data[prop];
    }
  }

  delete data.scraper;

  return data;
}

/*
  Check if the provided data contains any invalid fields
*/
function isValid(data, location) {
  if (data.cases === undefined) {
    throw new Error(`Invalid data: contains no case data`);
  }

  for (let [prop, value] of Object.entries(data)) {
    if (value === null) {
      throw new Error(`Invalid data: ${prop} is null`);
    }
    if (Number.isNaN(value))   {
      throw new Error(`Invalid data: ${prop} is not a number`);
    }
  }

  return true;
}

/*
  Add output data to the cases array. Input can be either an object or an array
*/
function addData(cases, location, result) {
  if (Array.isArray(result)) {
    for (let data of result) {
      if (isValid(data, location)) {
        cases.push(addLocationToData(data, location));
      }
    }
  }
  else {
    if (isValid(result, location)) {
      cases.push(addLocationToData(result, location));
    }
  }
}

/*
  Begin the scraping process
*/
async function scrape() {
  let cases = [];
  for (let location of scrapers) {
    if (location.scraper) {
      try {
        addData(cases, location, await location.scraper());
      }
      catch(err) {
        console.error('  ❌ Error processing %s: ', location.county, err);
      }
    }
  }

  return cases;
}

/*
  Generate a CSV from the given data
*/
function generateCSV(data) {
  return new Promise((resolve, reject) => {
    // Start with the columns we want first
    let columns = [
      'city',
      'county',
      'state',
      'country',
      'cases',
      'deaths',
      'recovered',
      'tested',
      'url'
    ];

    // Get list of columns
    for (let location of data) {
      for (let column in location) {
        if (columns.indexOf(column) === -1) {
          columns.push(column);
        }
      }
    }

    // Turn data into arrays
    let csvData = [
      columns
    ];
    for (let location of data) {
      let row = [];
      for (let column of columns) {
        row.push(location[column]);
      }
      csvData.push(row);
    }

    csvStringify(csvData, (err, output) => {
      if (err) {
        reject(err);
      }
      else {
        resolve(output);
      }
    });
  });
}

/*
  Main
*/
async function start() {
  console.log('⏳ Scraping data...');

  let cases = await scrape();

  await fs.writeFile(path.join('dist', 'data.json'), JSON.stringify(cases, null, 2));

  let csvString = await generateCSV(cases);

  await fs.writeFile(path.join('dist', 'data.csv'), csvString);

  console.log('✅ Data scraped for %d counties', cases.length);
};

start();

