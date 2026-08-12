local SAT_NAME      = "SAT-NAME"   -- name shown on the ground station screen
local SAT_CHANNEL   = 61           -- modem channel, must match the ground station
local SEND_INTERVAL = 1            -- seconds between telemetry packets
local ORBIT         = "LEO"        -- "LEO" or "GEO", used for the orbit filter

local POS_X, POS_Y, POS_Z = 0, 0, 0 -- satellite position

local modem = peripheral.find("modem") or error("No modem")
modem.open(SAT_CHANNEL)

while true do
    modem.transmit(SAT_CHANNEL, os.getComputerID(), {
        name = SAT_NAME,
        x = POS_X,
        y = POS_Y,
        z = POS_Z,
        orbit = ORBIT,

        -- add your own fields below, the ground station recognizes:
        -- vel = 12.4,          -- speed
        -- inclination = 51.6,  -- orbital inclination
        -- period = 92,         -- orbital period
        -- sat_status = "NOMINAL", -- satellite status
    })
    sleep(SEND_INTERVAL)
end
