var requestTimeout = 1000 * 10;  // 10 seconds

buttons = {
	services:[
		{service:"transmission", alias:"Transmission", schedulable:true},
		{service:"sabnzbd", alias:"SABnzbd+", schedulable:true},
		{service:"sickbeard", alias:"Sickbeard", schedulable:true},
		{service:"kodi", alias:"Kodi", schedulable:false},
	],
	devices:[
		{device: "button",alias: "Lamp", schedulable:false}
	]
}

window.onload=function(){
	buttons.services.forEach(function(value, index) {
		$("#services")[0].innerHTML += '<div class="service'+ (value.schedulable ? ' schedulable' : '') +'" data-service="'+value.service+'"><span class="label">'+value.alias+':</span><div class="btn-group" data-toggle="buttons-radio"><button type="button" class="btn btn-mini" value="1">stop</button><button type="button" class="btn btn-mini" value="0">start</button>' + (value.schedulable ? '<button type="button" class="btn btn-mini" value="2"><i class="icon icon-time"></i></button>' : '') + '</div></div>';
	});

	buttons.devices.forEach(function(value, index) {
		$("#devices")[0].innerHTML += '<div class="device'+ (value.schedulable ? ' schedulable' : '') +'" data-device="'+value.device+'"><span class="label">'+value.alias+':</span><div class="btn-group" data-toggle="buttons-radio"><button type="button" class="btn btn-mini"value="1">off</button><button type="button" class="btn btn-mini" value="0">on</button>' + (value.schedulable ? '<button type="button" class="btn btn-mini" value="2"><i class="icon icon-time"></i></button>' : '') + '</div></div>';
	});

	getUsage();
	getDriveUsage();

	setServiceStatus("transmission");
	setServiceStatus("sabnzbd");
	setServiceStatus("sickbeard");
	setServiceStatus("kodi");
	setDeviceStatus("button");
	document.getElementById("refresh").onclick = function(){ 
		this.style.display = 'none';
		getUsage();
	};

	$('.arrow').click(function() {
		if (!$(this).hasClass('disabled')){
			var targetDate;
			var _currentDate = new Date(currentDate);
			if ($(this).hasClass('left')){
				targetDate = _currentDate.setDate(_currentDate.getDate()-1);
			}else{
				targetDate = _currentDate.setDate(_currentDate.getDate()+1);
			}
			if (new Date(targetDate).setHours(0,0,0,0) === new Date(Date.now()).setHours(0,0,0,0)){
				targetDate = undefined;
			}
			getUsage(targetDate);
		}
	});

	$(".service button").click(function() {
		if ($(this).val() != 2 && $(this).hasClass('active')){
			//console.log("don't click on the active button!!");
			return;
		}

		var service = $(this).closest('.service')[0].dataset.service;
		var buttons = $("[data-service='"+service+"'] button");

		if ($(this).val() == 1) {
			$(buttons[0]).addClass('btn-danger').text('stopping...').addClass('disabled');
			$(buttons[1]).removeClass('btn-success');
			setServiceStatus(service,"stop");
		} else if ($(this).val() === "0") {
			$(buttons[0]).removeClass('btn-danger');
			$(buttons[1]).addClass('btn-success').text('starting...').addClass('disabled');
			setServiceStatus(service,"start");
		} else if ($(this).val() == 2) {
			$($buttons[2]).addClass('disabled');
			setServiceStatus(service, undefined, !$(this).hasClass('active'));
		}
	});

	$(".device button").click(function() {
		if ($(this).val() != 2 && $(this).hasClass('active')){
			//console.log("don't click on the active button!!");
			return;
		}

		var device = $(this).closest('.device')[0].dataset.device;
		var buttons = $("[data-device='"+device+"'] button");

		if ($(this).val() == 1) {
			$(buttons[0]).addClass('btn-danger').text('turning off...').addClass('disabled');
			$(buttons[1]).removeClass('btn-success');
			setDeviceStatus(device,"off");
		} else if ($(this).val() === "0") {
			$(buttons[0]).removeClass('btn-danger');
			$(buttons[1]).addClass('btn-success').text('turning on...').addClass('disabled');
			setDeviceStatus(device,"on");
		}
	});
};

function setServiceStatus(service, status, isScheduled) {
	var data = {"service": service};
	if (status !== undefined)
		data.status = status;
	if (isScheduled !== undefined)
		data.isScheduled = isScheduled;

	$.ajax({type: "PUT", dataType: "json", url: window.location.protocol + "//" + window.location.host +'/services', data: data, success: function(data){
		$($("[data-service='"+data.alias+"'] button")[0]).removeClass('btn-danger').text('stop').removeClass('disabled').removeClass('active');
		$($("[data-service='"+data.alias+"'] button")[1]).removeClass('btn-success').text('start').removeClass('disabled').removeClass('active');
		$($("[data-service='"+data.alias+"'] button")[2]).removeClass('active').removeClass('disabled');

		if(data.status === true)
			$($("[data-service='"+data.alias+"'] button")[1]).addClass('btn-success').text('started').addClass('active');
		else if (data.status === false)
			$($("[data-service='"+data.alias+"'] button")[0]).addClass('btn-danger').text('stopped').addClass('active');

		if (data.isScheduled === true)
			$($("[data-service='"+data.alias+"'] button")[2]).addClass('active');
		else
			$($("[data-service='"+data.alias+"'] button")[2]).removeClass('active');
	}});
}

function setDeviceStatus(device, status) {
	var data = {"device": device};
	if (status !== undefined)
		data.status = status;

	$.ajax({type: "PUT", dataType: "json", url: window.location.protocol + "//" + window.location.host +'/devices', data: data, success: function(data){
		$($("[data-device='"+device+"'] button")[0]).removeClass('btn-danger').text('off').removeClass('disabled').removeClass('active');
		$($("[data-device='"+device+"'] button")[1]).removeClass('btn-success').text('on').removeClass('disabled').removeClass('active');

		if(data.status === true)
			$($("[data-device='"+device+"'] button")[1]).addClass('btn-success').text('on').addClass('active');
		else if (data.status === false)
			$($("[data-device='"+device+"'] button")[0]).addClass('btn-danger').text('off').addClass('active');
	}});
}

var currentDate;
function getUsage(date) {
	var xhr = new XMLHttpRequest();
	var abortTimerId = window.setTimeout(function() {
		xhr.abort();  // synchronously calls onreadystatechange
		handleError("Request timed out.");
	}, requestTimeout);

	function handleSuccess(data) {
		window.clearTimeout(abortTimerId);

		//Handle any handled errors
		if (data.err && !data.devices){
			handleError(data.err);
			return;
		}

		currentDate = parseInt(data.date);

		if (new Date(currentDate).setHours(0,0,0,0) !== new Date(Date.now()).setHours(0,0,0,0)) {
			$('.arrow.right').removeClass('disabled');
		} 
		if (new Date(currentDate).getDate() != 1) {
			$('.arrow.left').removeClass('disabled');
		}

		var container = document.getElementById("container");
		var table = document.getElementById("table");

		var period = loadPageVar("period") ? loadPageVar("period") : 'Peak';

		table.tBodies[0].innerHTML = "";
		var totalbytes = 0, totalbytes_today = 0;
		data.devices.sort(function(a,b){
			if (period == "Peak" || period == "Night Surfer")
				return b.usageToday[period] - a.usageToday[period];
			else
				return b.today_bytes - a.today_bytes;
		});
		data.devices.forEach(function(value, index) {
			var device_total_bytes, device_today_bytes;
			if (period == "Peak" || period == "Night Surfer")
			{
				device_total_bytes = value.usageToDate[period];
				device_today_bytes = value.usageToday[period];
			} else {
				device_total_bytes = value.total_bytes;
				device_today_bytes = value.today_bytes;
			}

			table.tBodies[0].innerHTML += "<tr><td>"+ (value.device_name ? value.device_name : value.mac) +"<span class='hover' title='"+ value.ip +"\n"+ value.mac +"'>&hellip;</span><span class='details'>("+ value.ip + ")</span></td><td>"+ formatBytes(device_total_bytes,2) +"</td><td>"+ formatBytes(device_today_bytes,2) +"</td></tr>";
			totalbytes += Number(device_total_bytes);
			if (!isNaN(device_today_bytes)) {
				totalbytes_today += Number(device_today_bytes);
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
			console.log(error);
			handleError("XMLHttpRequest error.");
		};

		xhr.open("GET", window.location.protocol + "//" + window.location.host +'/summary/'+ (date || ''), true); //'http://localhost:8080/request'
		xhr.send(null);

		$('.arrow.right').addClass('disabled');
		$('.arrow.left').addClass('disabled');
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
			console.log(error);
			handleError("XMLHttpRequest error.");
		};

		xhr.open("GET", window.location.protocol + "//" + window.location.host +'/drives', true);
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

function loadPageVar(sVar) {
	return decodeURI(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + encodeURI(sVar).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
}
