"use strict;"

// No need for server
// Data gets deleted on clearing cookies

// TODO - allow to pick range of dates?

$(function(){
    const todayTill = 4;                        // Today counts till 4 am
    const chartLineColors = ['rgba(0, 10, 130, .7)', 'rgba(220, 20, 60, 1)', 'rgba(200, 99, 132, .9)', 'rgba(133, 0, 61, .9)', 'rgba(248, 144, 1, 1)', 'rgba(100, 180, 132, .9)'];
    
    var stats = {};
    var buttons = [];
    var lastMarked = -1;
    var myLineChart = null;

    let theme = window.localStorage["theme"] || "primary";
    setTheme();

    let _openRequest = indexedDB.open("drinks-full", 1);

    function initDB(){
        _openRequest.onupgradeneeded = function(){
            let db = _openRequest.result;

            if(!db.objectStoreNames.contains('drinks')){ 
                db.createObjectStore('drinks', {keyPath: 'id', autoIncrement: true});
            }

            this.transaction.objectStore("drinks").createIndex('type', 'type');
            this.transaction.objectStore("drinks").createIndex('created', 'created');
        }

        _openRequest.onerror = function(){
            console.error("onError", this.error);
        };

        _openRequest.onsuccess = function(){
            let db = this.result;
            let drinks = db.transaction("drinks", "readwrite").objectStore("drinks");

            drinks.getAll().onsuccess = function(){
                let data = this.result;

                if(data?.length){
                    let parsedData = {};
                    data.forEach(record => {
                        if(!parsedData.hasOwnProperty(record.type)){
                            parsedData[record.type] = [];
                        }

                        parsedData[record.type].push(record.created);
                    });

                    buttons = [];
                    for(const property in parsedData){
                        buttons.push(property);
                    }

                    stats = parsedData;
                   
                    renderButtons();
                    renderChart();
                    refreshStats();
                } else {
                    $("#start-arrow").addClass("show");

                    $("#plus").one("click", function(){
                        $("#start-arrow").removeClass("show");
                    });
                }
            }
        };
    }

    initDB();
    
    initListeners();
    initDates();
    setBackups();

    function addClick($button, e){
        let type = $button.text();
        let date;

        if(!stats.hasOwnProperty(type))
            stats[type] = [];

        if(e.offsetX > $button[0].offsetWidth){
            // :after click
            date = new Date(Date.now() - 86_400_000).toLocaleString("sv").slice(0, -3); 
        } else {
            // button click
            date = new Date().toLocaleString("sv").slice(0, -3);
        }
        
        let db = _openRequest.result;
        let drinks = db.transaction("drinks", "readwrite").objectStore("drinks");

        let col = {type: type, created: date};

        drinks.add(col);

        stats[type].push(date);
        refreshStats();
    }

    // Removes last drink of type
    function removeClick($button, all = false){
        let type = $button.text();

        let db = _openRequest.result;
        let drinks = db.transaction("drinks", "readwrite").objectStore("drinks");

        drinks.getAll().onsuccess = function(){
            // Array of objects
            let data = this.result;

            if(all){
                for(let i = data.length - 1; i >= 0; i--){
                    if(data[i].type == type){
                        drinks.delete(data[i].id);
                    }
                }
            } else {
                for(let i = data.length - 1; i >= 0; i--){
                    if(data[i].type == type){
                        drinks.delete(data[i].id);
                        break;
                    }
                }

                stats[type].pop();
            }

            refreshStats();
        }
    }

    function initListeners(){
        $(".theme-button").on("click", function(){
            theme = this.dataset.theme;
            window.localStorage["theme"] = theme;

            setTheme();
        });

        $(".modal").on("click", function(e){
            if(e.target.classList.contains("modal") || e.target.classList.contains("cancel-button"))
                $(".modal").addClass("fadeout");
        });

        $("#new-confirm").on("click", function(){
            if($("#new-input").val()){
                addNew($("#new-input"));
            }
        });

        $("#new-input").on("keydown", function(e){
            if(e.key == "Enter"){
                addNew($(this));
            }
        });

        $("#delete-confirm").on("click", function(){
            let $button = $(".buttons-main").eq(lastMarked);

            let removed = buttons.splice(lastMarked, 1);
            delete stats[removed];

            removeClick($button, true);

            $button.remove();
            $(".modal").addClass("fadeout");
        });

        $("#delete-wrapper").on("keydown", function(e){
            if(e.key == "Enter"){
                $("#delete-confirm")[0].click();
            }
        });

        $("#plus").on("click", function(){
            $("#add-new").removeClass("fadeout"); 
            $("#new-input").focus();
        });
        
        $("#main-button").on("click", function(){
            $(".main").removeClass("fadeout"); 
            $(".chart").addClass("fadeout");
        });
        
        $("#chart-button").on("click", function(){
            $(".chart").removeClass("fadeout"); 
            $(".main").addClass("fadeout");
        });
    }

    function setBackups(){
        $("#download-backup").on("click", function(){
            let link = $("#backup");

            link[0].href = "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(stats));
            link[0].click();
        });

        $("#upload-backup").on("click", function(){
            $("#backup-input").click();
        });

        $("#backup-input").on("change", function(e){
            let file = e.target.files[0];

            if(file){
                let reader = new FileReader();

                reader.onload = (ev) => {
                    try{
                        let data = JSON.parse(ev.target.result);

                        let db = _openRequest.result;
                        let drinks = db.transaction("drinks", "readwrite").objectStore("drinks");

                        drinks.clear().onsuccess = function(){
                            stats = {};
                            buttons = [];

                            for(const property in data){
                                for(record of data[property]){
                                    let col = {type: property, created: record};

                                    drinks.add(col);

                                    if(!stats.hasOwnProperty(property)){
                                        stats[property] = [];
                                        buttons.push(property);
                                    }
                                    
                                    stats[property].push(record);
                                }
                            }

                            renderButtons();
                            renderChart();
                            refreshStats();
                        };
                    } catch(err){console.log(err)}
                };

                reader.readAsText(file);
            }
        });
    }

    function initDates(){
        $(".date-button").on("click", function(){
            $(this).addClass("selected").siblings().removeClass("selected");
            filterStats($(this).text());
        });

        $(".date-button-chart").on("click", function(){
            $(this).addClass("selected-chart").siblings().removeClass("selected-chart");
            renderChart($(this).text());
        });
    }

    function filterStats(type){
        let time = 0;
        let now = new Date().getTime();
        let statsFiltered = {};
        
        switch(type.toLowerCase()){
            case "today":
                let now = new Date();
                let dayStart = new Date();
                dayStart.setHours(todayTill - 1,59,59,999);

                if(now.getHours() < todayTill){
                    time = (now - dayStart) * -1 + 20*3600*1000;
                } else {
                    time = now - dayStart;
                }
                break;
            case "day": case "24h":
                time = 86400 * 1000;
                break;
            case "week":
                time = 86400 * 7 * 1000;
                break;
            case "month":
                time = 86400 * 30 * 1000;
                break;
            case "all":
                renderStats(stats);
                return;
                break;
        }

        for(let key in stats){
            statsFiltered[key] = stats[key].filter(drinkTime => {
                return (new Date(drinkTime).getTime() > now - time);
            });
        }

        renderStats(statsFiltered);
    }
    
    function renderButtons(){
        let buttonsHtml = buttons.map((button) => {
            return "<div class=button-wrapper><button class='buttons-main ripple-button bttn-gradient bttn-lg bttn-" + theme + " bttn-class'>" + button + "</button></div>";
        }).join("");

        $("#buttons").html(buttonsHtml);

        let $buttonsMain = $(".buttons-main");
        
        $buttonsMain.on("click", function(e){
            if(e.ctrlKey){
                lastMarked = $(this).parent(".button-wrapper").index();
                $("#remove-button").removeClass("fadeout"); 
                $("#delete-wrapper").focus();

                return;
            }

            if(e.shiftKey){
                removeClick($(this));
                return;
            }

            addClick($(this), e);
        });
        
        document.querySelectorAll(".ripple-button").forEach(button => {
            addRipple(button);
        });
    }

    function renderStats(statsFiltered){
        let lowestDay = "3000";

        for(const stat in statsFiltered){
            if(lowestDay > statsFiltered[stat][0])
                lowestDay = statsFiltered[stat][0];
        }

        let then = new Date(lowestDay).getTime();
        let today = new Date().getTime();
        let dayCount = Math.ceil((today - then) / 86400000);
        let newest = "";

        let statsArray = [];
        for(const stat in statsFiltered){
            let average = Math.round(statsFiltered[stat].length/dayCount*10)/10;
            statsArray.push("<li id='stat-" + stat + "'><span class=title>" + stat + "</span><span class=counts><span class=average>" + average + "</span><span class=count>" + statsFiltered[stat].length + "</span></span></li>");

            if(newest < statsFiltered[stat][statsFiltered[stat].length - 1]){
                newest = statsFiltered[stat][statsFiltered[stat].length - 1];
            }
        }

        let nav = "<li style='overflow:hidden'><span class=counts><span class='average stats-head'>Daily</span><span class='count stats-head'>Total</span></li>";
        let statsHtml = "<ul>" + nav + statsArray.sort(function(a, b){
            return parseInt(b.match(/count>(\d+)</)[1]) - parseInt(a.match(/count>(\d+)</)[1]);
        }).join("") + "</ul>";

        $("#stats").html(statsHtml);
        $("#latest-count").text(newest);
        $("#stats-wrapper").css({opacity: 1});
    }

    function refreshStats(){
        filterStats($(".selected").text());
    }

    function addNew($input){
        let type = $input.val();

        buttons.push(type);
        stats[type] = [];

        let date = new Date().toLocaleString("sv").slice(0, -3);
        
        let db = _openRequest.result;
        let drinks = db.transaction("drinks", "readwrite").objectStore("drinks");

        let col = {type: type, created: date};
        stats[type].push(date);

        drinks.add(col).onsuccess = function(){
            renderButtons();
            refreshStats();

            $input.val("");
            $("#add-new").addClass("fadeout");
        };
    }

    function setTheme(){
        $(".bttn-class").each(function(){
            $(this).removeClass(["bttn-primary", "bttn-warning", "bttn-danger", "bttn-success"]);
            $(this).addClass("bttn-" + theme);
        });
        
        $(".theme-" + theme).addClass("theme-button-selected").siblings().removeClass("theme-button-selected");

        switch(theme){
            case "primary":
                document.documentElement.style.setProperty("--selected-background", "#1d89ff");
                document.documentElement.style.setProperty("--selected-background-secondary", "#006de3");
                break;
            case "warning":
                document.documentElement.style.setProperty("--selected-background", "#feab3a");
                document.documentElement.style.setProperty("--selected-background-secondary", "#f89001");
                break;
            case "danger":
                document.documentElement.style.setProperty("--selected-background", "#ff5964");
                document.documentElement.style.setProperty("--selected-background-secondary", "#ff1424");
                break;
            case "success":
                document.documentElement.style.setProperty("--selected-background", "#28b78d");
                document.documentElement.style.setProperty("--selected-background-secondary", "#209271");
                break;
        }
    }    
    
    function renderChart(type = "all"){
        let chartData = {};
        let allDates = [];
        let time;

        let now = new Date();
        now.setHours(23,59,59,999);
        now = now.getTime();
        
        switch(type.toLowerCase()){
            case "week":
                time = 86400 * 7 * 1000;
                break;
            case "month":
                time = 86400 * 30 * 1000;
                break;
            case "all":
                time = now;
                break;
        }
        
        // Create object with two arrays - one for days and second for corresponding drink count
        for(let key in stats){
            // key = drink
            chartData[key] = {
                dates: [],
                counts: []
            };

            stats[key].sort((a, b) => a.localeCompare(b));

            let count = 0;
            let skip = false;
            // let yesterdayCounted = false;
            for(let i = 0; i < stats[key].length; i++){
                let statsDate = new Date(stats[key][i]);
                if(!(statsDate.getTime() > now - time)){
                    skip = true;
                    continue;
                }

                // If hours lower than todayTill change date to previous day
                if(statsDate.getHours() < todayTill){
                    statsDate.setHours(statsDate.getHours() - todayTill);

                    stats[key][i] = statsDate.toISOString().slice(0, 16);
                }

                // Only one date exists for this type
                if(stats[key].length == 1){
                    chartData[key].dates.push(stats[key][i].slice(0, 10));
                    chartData[key].counts.push(1);
                    break;
                }

                // If next date is different from current push counted dates and reset count
                if((!skip) && (i != 0) && ((stats[key][i].slice(0, 10) != stats[key][i - 1].slice(0, 10)))){
                    if(i != 0){
                        chartData[key].dates.push(stats[key][i - 1].slice(0, 10));
                        chartData[key].counts.push(count);
                        count = 1;
                    }
                } else {
                    skip = false;
                    count++;
                }

                // Last date in array - push counted dates
                if(stats[key].length == i + 1){
                    chartData[key].dates.push(stats[key][i].slice(0, 10));
                    chartData[key].counts.push(count);
                    count = 1;
                    break;
                }
            }

            allDates.push(...chartData[key].dates);
        }

        // Create array of all dates that will show
        switch(type.toLowerCase()){
            case "week":
                allDates = [];
                for(let i = 6; i >= 0; i--){
                    let date = new Date(now - i * 86400 * 1000).toISOString().slice(0, 10);
                    allDates.push(date);
                }
                break;
            case "month":
                allDates = [];
                for(let i = 29; i >= 0; i--){
                    let date = new Date(now - i * 86400 * 1000).toISOString().slice(0, 10);
                    allDates.push(date);
                }
                break;
            case "all":
                allDates = [...new Set(allDates)].sort();

                let then = new Date(allDates[0]).getTime();
                let today = new Date().getTime();
                let dayCount = Math.ceil((today - then) / 86400000);
                
                allDates = [];
                for(let i = dayCount; i >= 0; i--){
                    let date = new Date(now - i * 86400 * 1000).toISOString().slice(0, 10);
                    allDates.push(date);
                }
                break;
        }
        
        // Fill empty dates
        for(let key in chartData){
            for(let j = 0; j < allDates.length; j++){
                if(chartData[key].dates[j] != allDates[j]){
                    chartData[key].dates.splice(j, 0, allDates[j]);
                    chartData[key].counts.splice(j, 0, 0);
                }
            }
        }

        let ctxl = $("#lineChart")[0].getContext('2d');
        
        let chartRenderData = [];
        
        let i = 0;
        for(let key in chartData){
            chartRenderData.push({
                label: key,
                data: chartData[key].counts,
                lineTension: 0,                     // Line smoothness
            backgroundColor: chartLineColors[i],
                fill: false,
                borderColor: chartLineColors[i],
                borderWidth: 1
            });
            i++;
        }
        
        if(myLineChart == null){
            myLineChart = new Chart(ctxl, {
                type: 'line',
                data: {
                    labels: allDates,
                    datasets: chartRenderData
                },
                options: {
                    scales: {
                        yAxes: [{
                            ticks: {
                                userCallback: function(tick){
                                    if(Number.isInteger(tick))
                                        return tick;
                                    else
                                        return "";
                                }
                            }
                        }]
                    },
                    responsive: true,
                    animation: {
                        duration: 2000
                    }
                }
            });
        } else {
            // Update chart with new data
            myLineChart.config.data.labels = allDates;
            
            let i = 0;
            for(let key in chartData){
                myLineChart.config.data.datasets[i].label = key;
                myLineChart.config.data.datasets[i].data = chartData[key].counts;
                i++;
            }
            
            myLineChart.update();
        }
    }

    function addRipple(button){
        button.addEventListener("click", function(e){
            let x, y;
            if((e.originalEvent || e).isTrusted){
                x = e.offsetX;
                y = e.offsetY;
            } else {
                x = e.target.clientWidth / 2;
                y = e.target.clientHeight / 2;
            }

            let html = "<span class='ripple' style='left:" + x + "px;top:" + y + "px;'></span>";

            button.insertAdjacentHTML("beforeend", html);
        
            setTimeout(function(){
                button.querySelector(".ripple").remove();
            }, 1000);
        });
    }
});
