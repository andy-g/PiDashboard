var requestTimeout = 1000 * 30;  // 5 seconds
var serviceUri = "http://localhost"; //Update to point to location where node service is hosted.

window.onload=function(){
	getUsage();
	getDriveUsage();
	setServiceStatus("transmission");
	document.getElementById("refresh").onclick = function(){ 
		this.style.display = 'none';
		getUsage();
	}

	$("[name='includeicon']").click(function() {
		if ($(this).hasClass('active')){
			//console.log("don't click on the active button!!");
			return;
		}
		if ($(this).val() == 1) {
			$("[name='includeicon']:eq(0)").addClass('btn-danger').text('stopping...').addClass('disabled');
			$("[name='includeicon']:eq(1)").removeClass('btn-success');
			setServiceStatus("transmission","stop");
		} else {
			$("[name='includeicon']:eq(0)").removeClass('btn-danger');
			$("[name='includeicon']:eq(1)").addClass('btn-success').text('starting...').addClass('disabled');
			setServiceStatus("transmission","start");
		}
	});
};

function setServiceStatus(service, status) {
	if (status === undefined)
		data = {"service": service};
	else
		data = {"service": service, "status": status};

	$.getJSON(serviceUri+'/serviceStatus', data).done(function(data){
		$("[name='includeicon']:eq(0)").removeClass('btn-danger').text('stop').removeClass('disabled');
		$("[name='includeicon']:eq(1)").removeClass('btn-success').text('start').removeClass('disabled');

		if(data.status == true)
			$("[name='includeicon']:eq(1)").addClass('btn-success').text('started').addClass('active');
		else
			$("[name='includeicon']:eq(0)").addClass('btn-danger').text('stopped').addClass('active');
	});
}

function getUsage() {
	var xhr = new XMLHttpRequest();
	var abortTimerId = window.setTimeout(function() {
		xhr.abort();  // synchronously calls onreadystatechange
		handleError("Request timed out.");
	}, requestTimeout);

	function handleSuccess(data) {
		window.clearTimeout(abortTimerId);

		//Handle any handled errors
		if (data.err && !data.stats){
			handleError(data.err);
			return;
		}

		//data.stats.sort(function(a,b){ return a.device_name.toUpperCase() > b.device_name.toUpperCase() });
		data.stats.sort(function(a,b){ return b.today_bytes - a.today_bytes; });

		var container = document.getElementById("container");
		var table = document.getElementById("table");

		table.tBodies[0].innerHTML = "";
		var totalbytes = 0,
			totalbytes_today = 0;
		data.stats.forEach(function(value, index) {
			table.tBodies[0].innerHTML += "<tr><td>"+ (value.device_name ? value.device_name : value.mac_add) +"<span class='hover' title='"+ value.ip_add +"\n"+ value.mac_add +"'>&hellip;</span><span class='details'>("+ value.ip_add + ")</span></td><td>"+ formatBytes(value.total_bytes,2) +"</td><td>"+ formatBytes(value.today_bytes,2) +"</td></tr>";
			totalbytes += Number(value.total_bytes);
			if (!isNaN(value.today_bytes)) { 
				totalbytes_today += Number(value.today_bytes); 
			}
		});

		table.tBodies[0].innerHTML += "<tr><td>"+ "" +"</td><td>"+ formatBytes(totalbytes,2) +"</td><td>"+ formatBytes(totalbytes_today,2) +"</td></tr>";

		container.style.display = 'none';
		table.style.display = 'table';
		document.getElementById("refresh").style.display = 'block';
	}

	function handleError(e) {
		var container = document.getElementById("container");
		container.innerHTML = e;
		container.style.display = 'block';
		container.style.width = '250px';
		table.style.display = 'none';
		document.getElementById("refresh").style.display = 'block';

		window.clearTimeout(abortTimerId);
	}

	try {
		xhr.onreadystatechange = function(){
			if (xhr.readyState != 4)
				return;

			if (xhr.responseText)
				handleSuccess(JSON.parse(xhr.responseText));//return;
			else
				handleError("error in XMLHttpRequest response.");
		};

		xhr.onerror = function(error) {
			console.log(e);
			handleError("XMLHttpRequest error.");
		};

		xhr.open("GET", serviceUri+'/request', true); //'http://localhost:8080/request'
		xhr.send(null);
	} catch(e) {
		handleError();
		console.log('error');
	}
}

function getDriveUsage() {
	var xhr = new XMLHttpRequest();
	var abortTimerId = window.setTimeout(function() {
		xhr.abort();  // synchronously calls onreadystatechange
		handleError("Request timed out.");
	}, requestTimeout);

	function handleSuccess(data) {
		window.clearTimeout(abortTimerId);
		var container = document.getElementById("usage");
		data.drives.forEach(function(value, index) {
			var percentUsed = parseInt(value.used.replace('%',''));
			if (percentUsed >= 95)
				status = "danger";
			else if (percentUsed >= 75)
				status = "warning";
			else
				status = "success";
			
			//container.innerHTML += "<small><strong>"+ value.mount +"</strong> <span class='muted'>"+ value.avail +" free of "+ value.size +"</span></small><div class='progress progress-"+ status +"'><div class='bar' style='width: "+ value.used +"'></div></div>";
			container.innerHTML += "<small><strong>"+ value.mount +"</strong> <span class='muted'>"+ value.avail +" free of "+ value.size +"</span></small><div class='progress progress-"+ status +"'><div class='bar' style='width: 0%'></div></div>";
		});
		
		data.drives.forEach(function(value, index) {
			var percentUsed = parseInt(value.used.replace('%',''));
			$($(".bar")[index]).width(percentUsed+'%');
		});
		//$(".bar")[0].width = 0;
	}

	function handleError(e) {
		window.clearTimeout(abortTimerId);
	}

	try {
		xhr.onreadystatechange = function(){
			if (xhr.readyState != 4)
				return;

			if (xhr.responseText)
				handleSuccess(JSON.parse(xhr.responseText));//return;
			else
				handleError("error in XMLHttpRequest response.");
		};

		xhr.onerror = function(error) {
			console.log(e);
			handleError("XMLHttpRequest error.");
		};

		xhr.open("GET", serviceUri+'/drives', true);
		xhr.send(null);
	} catch(e) {
		handleError();
		console.log('error');
	}
}

function formatBytes(bytes, precision)
{
	if (isNaN(bytes)) { return bytes; }
		
    var units = ['b', 'KB', 'MB', 'GB', 'TB'];
    bytes = Math.max(bytes, 0);
    var pwr = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
    pwr = Math.min(pwr, units.length - 1);
    bytes /= Math.pow(1024, pwr);
	return bytes.toFixed(precision) + ' ' + units[pwr];
}
