var requestTimeout = 1000 * 30;  // 5 seconds

window.onload=function(){
	getUsage();
	getDriveUsage();
	setServiceStatus("transmission");
	setServiceStatus("sabnzbd");
	setServiceStatus("sickbeard");
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

	$("[name='service']").click(function() {
		if ($(this).val() != 2 && $(this).hasClass('active')){
			//console.log("don't click on the active button!!");
			return;
		}

		if ($(this).val() == 1) {
			$("[data-service='"+this.dataset.service+"']:eq(0)").addClass('btn-danger').text('stopping...').addClass('disabled');
			$("[data-service='"+this.dataset.service+"']:eq(1)").removeClass('btn-success');
			setServiceStatus(this.dataset.service,"stop");
		} else if ($(this).val() === "0") {
			$("[data-service='"+this.dataset.service+"']:eq(0)").removeClass('btn-danger');
			$("[data-service='"+this.dataset.service+"']:eq(1)").addClass('btn-success').text('starting...').addClass('disabled');
			setServiceStatus(this.dataset.service,"start");
		} else if ($(this).val() == 2) {
			$("[data-service='"+this.dataset.service+"']:eq(2)").addClass('disabled');
			setServiceStatus(this.dataset.service, undefined, !$(this).hasClass('active'));
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
		$($("[data-service='"+data.alias+"']")[0]).removeClass('btn-danger').text('stop').removeClass('disabled').removeClass('active');
		$($("[data-service='"+data.alias+"']")[1]).removeClass('btn-success').text('start').removeClass('disabled').removeClass('active');
		$($("[data-service='"+data.alias+"']")[2]).removeClass('active').removeClass('disabled');

		if(data.status === true)
			$($("[data-service='"+data.alias+"']")[1]).addClass('btn-success').text('started').addClass('active');
		else if (data.status === false)
			$($("[data-service='"+data.alias+"']")[0]).addClass('btn-danger').text('stopped').addClass('active');

		if (data.isScheduled === true)
			$($("[data-service='"+data.alias+"']")[2]).addClass('active');
		else
			$($("[data-service='"+data.alias+"']")[2]).removeClass('active');
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

		table.tBodies[0].innerHTML = "";
		var totalbytes = 0, totalbytes_today = 0;
		data.devices.sort(function(a,b){
			return b.today_bytes - a.today_bytes;
		});
		data.devices.forEach(function(value, index) {
			table.tBodies[0].innerHTML += "<tr><td>"+ (value.device_name ? value.device_name : value.mac) +"<span class='hover' title='"+ value.ip +"\n"+ value.mac +"'>&hellip;</span><span class='details'>("+ value.ip + ")</span></td><td>"+ formatBytes(value.total_bytes,2) +"</td><td>"+ formatBytes(value.today_bytes,2) +"</td></tr>";
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
