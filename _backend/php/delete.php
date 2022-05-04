<?php
    require "database.php";

    $type = $_GET["type"];
    $all = $_GET["all"] ?? false;

    $cmd = "DELETE FROM drinks ";
    if($all){
        $cmd .= "WHERE type = '".$type."'";
    } else {
        $cmd .= "WHERE type = '".$type."' ORDER BY created DESC LIMIT 1";
    }

    if($err = Db::query($cmd)){
        Db::dbError($err, $cmd, __FILE__, __LINE__);
    }

    echo "1";
    exit();