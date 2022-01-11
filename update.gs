function updateSpreadsheets() {
  // get sensor ids and their current chunk sheet, if they exist. if does not exist, create new ones
  var config_ss = SpreadsheetApp.getActiveSpreadsheet();
  var config_main_sheet = SpreadsheetApp.getActiveSheet();
  var data = config_main_sheet.getDataRange().getValues();
  var open_aq_ids = []
  var new_entry = []

  // get all sheet names
  const sheet_names = config_ss.getSheets().map(sheet => {
    return sheet.getName().toString();
  });


  for (var i = 1; i < data.length; i++) {
    var open_aq_id = data[i][1];
    open_aq_ids.push(open_aq_id); // save all OpenAQ ids for later use

    // check if sheet exists for the open_aq_id
    // if not, create a new sheet and create a spreadsheet for storing data from that sensor
    if (!sheet_names.includes(open_aq_id.toString())) {
      var current_date = new Date();
      var new_sheet = config_ss.insertSheet(open_aq_id.toString());
      new_sheet.appendRow(['Start Date', 'End Date', 'Sheet ID']);
      Logger.log('New sheet created in config spreadsheet');
      var ss_new = SpreadsheetApp.create(open_aq_id + " - " + current_date.toDateString());
      var id = ss_new.getId();
      Logger.log('New spreadsheet created for data. ID: ');
      Logger.log(id);

      // update permissions for the new spreadsheet
      var new_file = DriveApp.getFileById(id);
      new_file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      new_sheet.appendRow([current_date.toISOString(), '', id]);

    } else {
      Logger.log(open_aq_id);
      // here, we check to see if the latest data in the sheet is older than a month. if so, we create a new sheet
      // and start recording data at the sheet of this new entry.
      var current_sheet = config_ss.getSheetByName(open_aq_id);
      var current_start_date = new Date(current_sheet.getRange(current_sheet.getLastRow(), 1).getValue());

      // open correct sheet
      var current_data_sheet_id = current_sheet.getRange(current_sheet.getLastRow(),3).getValue();
      var current_data_sheet = SpreadsheetApp.openById(current_data_sheet_id).getActiveSheet();
      if (current_data_sheet.getLastRow() > 1) { // check to make sure that some data has actually been written
        // get last date written
        var current_last_date = new Date(current_data_sheet.getRange(current_data_sheet.getLastRow(), 1).getValue());

        // compare last date written to date the sheet was created
        // if greater than a month, write the last date to the config sheet
        var month_diff = current_last_date.getMonth() - current_start_date.getMonth() + (12 * (current_last_date.getFullYear() - current_start_date.getFullYear()))

        // create a new spreadsheet to store the data
        if (month_diff > 0) {
          var values = [current_start_date.toISOString(), current_last_date.toISOString(), current_data_sheet_id];
          current_sheet.deleteRow(current_sheet.getLastRow());
          current_sheet.appendRow(values); // update the last row of data
          // create a new spreadsheet
          // update permissions for that spreadsheet
          var current_date = new Date();
          var ss_new = SpreadsheetApp.create(open_aq_id + " - " + current_date.toDateString());
          var id = ss_new.getId();
          Logger.log('New spreadsheet created for data. ID: ');
          Logger.log(id);

          // update permissions for the new spreadsheet
          var new_file = DriveApp.getFileById(id);
          new_file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

          // write this new sheet to the row
          current_sheet.appendRow([current_date.toISOString(), '', id]);
          }
      }
    }
  }

  Logger.log('Existing sensor ids: ');
  Logger.log(open_aq_ids);

  var last_dates = [];
  var sheet_ids = [];

  // For each existing sensor, get the last date written
  for (const open_aq_id of open_aq_ids) {
    var lastRow = config_ss.getSheetByName(open_aq_id).getLastRow();
    var lastColumn = config_ss.getSheetByName(open_aq_id).getLastColumn();
    var lastCell = config_ss.getSheetByName(open_aq_id).getRange(lastRow, lastColumn);
    var current_sheet_id = lastCell.getValue();
    var current_ss = SpreadsheetApp.openById(current_sheet_id);
    Logger.log('Opened spreadsheet to insert data. ID: ');
    Logger.log(current_sheet_id);

    sheet_ids.push(current_sheet_id);

    if (current_ss.getLastRow() == 0) {
      var earlier = new Date();
      earlier.setHours(Math.max(0, earlier.getHours() - 2));
      var current_last_date = earlier.toISOString();
      new_entry.push(true);
    } else {
      var current_last_date = current_ss.getActiveSheet().getRange(current_ss.getLastRow(), 1).getValue();
      var current_last_date_obj = new Date(current_last_date);
      // Add a minute to avoid double counting entries
      current_last_date_obj.setMinutes(current_last_date_obj.getMinutes() + 1);
      current_last_date = current_last_date_obj.toISOString();
      Logger.log(current_last_date);
      new_entry.push(false);
    }


    Logger.log('-- last date written: ' + current_last_date);
    last_dates.push(current_last_date);
  }

  for (var i = 0; i < open_aq_ids.length; i++) {
    var current_last_date = last_dates[i];
    var current_openaq_id = open_aq_ids[i];
    var current_sheet_id = sheet_ids[i];
    var current_new_entry = new_entry[i];

    sendRequest(current_openaq_id, current_sheet_id, current_last_date, current_new_entry);
  }

  // const sheet_id = '1lTlBIDxfD2LuGjXWlIccm5b8N2qSFcPTdByk_t37B1M';
  // var last_date = new Date();
  // Logger.log(last_date.toISOString());
  // last_date.setDate(last_date.getDate()-1);

  // Send the request!
  // sendRequest(open_aq_ids[1], sheet_id, last_date.toISOString());

  // get the last time that data was written to the sheet
  // pull data from that time to current time
  // write data to the sheet

}

function sendRequest(location_id, sheet_id, last_date, new_entry) {
  var current_date = new Date().toISOString();
  Logger.log('HITTING API FOR :' + location_id + ' | ' + sheet_id + ' | from: ' + last_date + ' to: ' + current_date);
  try {
    var response = UrlFetchApp.fetch('https://docs.openaq.org/v2/measurements?date_from=' + last_date +'&date_to=' + current_date + '&page=1&offset=0&sort=asc&radius=1000&location_id=' + location_id.toString() + '&order_by=datetime');
    var json = response.getContentText();
    var results = JSON.parse(json)['results'];

    Logger.log(results);
    if (results.length === 0) {
      Logger.log('NO NEW RESULTS FOR ' + location_id);
      return
    }
    var current_ss = SpreadsheetApp.openById(sheet_id);
    var current_sheet = current_ss.getActiveSheet();
    if (new_entry) {
      entryToRow(results).forEach(row => current_sheet.appendRow(row));
    } else {
      entryToRow(results).slice(1).forEach(row => current_sheet.appendRow(row));
    }
  } catch (error) {
    Logger.log(error)
  }

}

function entryToRow(results) {
  array = Object.keys(results[0]);
  array = array.filter(item => !(item === 'date' || item == 'coordinates'));
  var keys = ['date-utc', 'date-local', 'coordinates'];
  keys = keys.concat(array);

  var ret = []
  ret.push(keys)

  for (const el of results) {
    var temp = []
  
    temp.push(el['date']['utc'])
    temp.push(el['date']['local'])
    temp.push(el['coordinates']['latitude'] + ', ' + el['coordinates']['longitude'])
  
    for (var item in el) {
      if (!(item === 'date' || item === 'coordinates')) temp.push((el[item]));
    }

    ret.push(temp);
  }

  return ret
}
