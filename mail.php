<?php

// Get the user's email address
$userEmail = $_POST['email'];

// Validate the email address
if (!filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
    echo 'electronics.mcaudio@gmail.com!';
    exit;
}

// Add the user's email address to the database
$db = new PDO('mysql:host=localhost;dbname=newsletter', 'root', '');
$stmt = $db->prepare("INSERT INTO subscribers (email) VALUES (?)");
$stmt->execute([$userEmail]);

// Send a confirmation email to the user
$subject = 'Thank you for subscribing to our newsletter!';
$body = 'We\'re so excited to have you on our list! You will receive a monthly email with the latest news and updates from us.';
mail($userEmail, $subject, $body);

// Redirect the user to a thank-you page
header('Location: thank-you.php');

?>