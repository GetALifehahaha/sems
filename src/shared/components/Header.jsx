import React from "react";
import BlockTitle from "../styles/BlockTitle";
import NotificationCenter from "./NotificationCenter";

const Header = ({ liveData = {}, PAYMENT_RATE = 12 }) => {
    return (
        <div className="px-8 py-2.5 mb-8 flex items-center justify-between">
            <BlockTitle>SEMS</BlockTitle>
            <NotificationCenter
                liveData={liveData}
                PAYMENT_RATE={PAYMENT_RATE}
            />
        </div>
    );
};

export default Header;
