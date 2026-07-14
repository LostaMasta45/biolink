$key = (Get-Content .env.local | Select-String "KIRIMDEV_API_KEY=").ToString().Split("=")[1]
$body = @{
    messaging_product = "whatsapp"
    to = "6283122866975"
    type = "interactive"
    interactive = @{
        type = "button"
        body = @{ text = "Test button" }
        action = @{
            buttons = @(
                @{ type = "reply"; reply = @{ id = "btn1"; title = "Button 1" } },
                @{ type = "reply"; reply = @{ id = "btn2"; title = "Button 2" } }
            )
        }
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "https://api.kirimdev.com/v1/1106343869238385/messages" -Method POST -Headers @{ "Authorization" = "Bearer $key"; "Content-Type" = "application/json" } -Body $body
