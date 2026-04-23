import React from "react";
import BlockTitle from "../styles/BlockTitle";
import NotificationCenter from "./NotificationCenter";

const Header = ({ liveData = {} }) => {
    return (
        <div className="px-8 py-2.5 mb-8 flex items-center justify-between">
            <BlockTitle>SEMS</BlockTitle>
            <NotificationCenter liveData={liveData} />
        </div>
    );
};

export default Header;
