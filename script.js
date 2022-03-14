"use strict;"

// $(".modal").fadeOut(0);
// $(".chart").fadeOut(0);
// TODO - allow to pick range of dates?

const todayTill = 4;                        // Today counts till 4 am
const chartLineColors = ['rgba(0, 10, 130, .7)', 'rgba(220, 20, 60, 1)', 'rgba(200, 99, 132, .9)', 'rgba(133, 0, 61, .9)', 'rgba(248, 144, 1, 1)', 'rgba(100, 180, 132, .9)'];

$(function(){
    var stats = {};
    var buttons = [];

    let theme = window.localStorage["theme"] || "primary";
    setTheme();

    let _openRequest = indexedDB.open("drinks-full", 1);

    function init(){
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
                    let unique = {};
                    data.forEach(record => {
                        if(unique.hasOwnProperty(record.type)){
                            ++unique[record.type];
                        } else {
                            unique[record.type] = 1;
                        }
                    });

                    let realData = {};
                    data.forEach(record => {
                        if(!realData.hasOwnProperty(record.type)){
                            realData[record.type] = [];
                        }

                        realData[record.type].push(record.created);
                    });

                    buttons = [];
                    for(const property in unique){
                        buttons.push(property);
                    }

                    stats = realData;
                   
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

    init();

    let lastMarked = -1;
    let myLineChart = null;
    
    initListeners();
    initDates();

    function addClick($button, e){
        let text = $button.text();
        let date;

        if(!stats.hasOwnProperty(text))
            stats[text] = [];

        if(e.offsetX > $button[0].offsetWidth){
            // :after click
            date = new Date(Date.now() - 86_400_000).toLocaleString("sv").slice(0, -3); 
        } else {
            // button click
            date = new Date().toLocaleString("sv").slice(0, -3);
        }
        
        let db = _openRequest.result;
        let drinks = db.transaction("drinks", "readwrite").objectStore("drinks");

        let col = {type: text, created: date};

        drinks.add(col);

        stats[text].push(date);
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

            setTheme();

            window.localStorage["theme"] = theme;
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

            window.localStorage["buttons"] = JSON.stringify(buttons);
            window.localStorage["stats"] = JSON.stringify(stats);

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
                let dayStart = new Date();
                dayStart.setHours(todayTill - 1,59,59,999);
                let now = new Date();

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
        let val = $input.val();

        buttons.push(val);
        stats[val] = [];

        let date = new Date().toLocaleString("sv").slice(0, -3);
        
        let db = _openRequest.result;
        let drinks = db.transaction("drinks", "readwrite").objectStore("drinks");

        let col = {type: val, created: date};
        stats[val].push(date);

        drinks.add(col).onsuccess = function(){
            refreshStats();
            renderButtons();

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

        // Filled background charts
        // var firstGradient = ctxl.createLinearGradient(0, 0, 200, 200);
        // firstGradient.addColorStop(0, "rgba(10,3,138,0.4)");
        // firstGradient.addColorStop(0.5, "rgba(91,91,255,0.4)");
        // firstGradient.addColorStop(1, "rgba(0,189,227,0.4)");
        
        // var secondGradient = ctxl.createLinearGradient(0, 0, 200, 200);
        // secondGradient.addColorStop(0, "rgba(82,0,103,0.4)");
        // secondGradient.addColorStop(0.5, "rgba(215,100,255,0.4)");
        // secondGradient.addColorStop(1, "rgba(223,144,255,0.4)");
        
        // var thirdGradient = ctxl.createLinearGradient(0, 0, 200, 200);
        // thirdGradient.addColorStop(0, "rgba(133,0,61,0.4)");
        // thirdGradient.addColorStop(0.5, "rgba(103,9,121,0.4)");
        // thirdGradient.addColorStop(1, "rgba(175,0,255,0.4)");
        
        // var fourthGradient = ctxl.createLinearGradient(0, 0, 200, 200);
        // fourthGradient.addColorStop(0, "rgba(166,0,103,0.6)");
        // fourthGradient.addColorStop(0.5, "rgba(215,170,255,0.4)");
        // fourthGradient.addColorStop(1, "rgba(111,66,255,0.4)");

        // let chartColors = [firstGradient, secondGradient, thirdGradient, fourthGradient];

        let ctxl = $("#lineChart")[0].getContext('2d');
        
        let chartRenderData = [];
        
        let i = 0;
        for(let key in chartData){
            chartRenderData.push({
                label: key,
                data: chartData[key].counts,
                lineTension: 0,                     // Line smoothness
            //    backgroundColor: chartColors[i],
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
                    },
                    legend: {
                        labels: {
                            // usePointStyle: true,
                        }
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
