# Catering Management System

## Description
This project provides REST APIs for a catering management system. The API is designed to handle various aspects of a catering business, including user management, orders, payments, and customer interactions.

## Overview
- This is a fully private API, meaning access is restricted to authorized users only.
- The API facilitates seamless management of catering services, including customer registration, order placement, and payment processing.

## Key Features
- **User Management:** Admins can create and manage users (Admins, Managers, and Customers).
- **Authentication & Authorization:** Secure login, registration, and role-based access control using `hono/jwt`.
- **Orders System:** Create, update, retrieve, and delete customer orders.
- **Payments Management:** Record payments, track dues and advance amounts, and manage customer transactions.
- **Customer Portal:** Customers can view their orders and payments using a temporary access key.
- **Access Control:** Only authorized users (Admins and Managers) can perform specific actions such as creating new users or deleting data.

## Tech Stack
- **Backend Framework:** Node.js (Hono.js)
- **Database:** MongoDB
- **Authentication:** `hono/jwt`
- **Email Service:** Nodemailer (for sending registration emails)
- **File Storage:** AWS S3 (Private bucket)
- **AWS SDK:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

## Super Admin Setup
The application does not have any users by default. When the app runs for the first time, a **Super Admin** must be created.  
To create a Super Admin, send a `POST` request to:

```
/users/auth/super-admin
```

No request body is needed. However, you must configure the Super Admin credentials in the `.env` file:

```env
# Super Admin Credentials
ADMIN_NAME="Super Admin" 
ADMIN_EMAIL="super@gmail.com" 
ADMIN_PASSWORD="Pass1234"
ADMIN_PHONE="01975024242" 
ADMIN_NID="5467474206"
```
Installation & Setup
Clone the repository:

sh
Copy
Edit
```
git clone https://github.com:anamulhoquewd/catering-management-system.git
```
cd catering-management
Install dependencies:

```
npm install
```
Set up the .env file with the necessary configuration.

Start the server:

```
npm run dev
```

## 📌 API Documentation & Testing  
You can test the API using Postman:  
🔗 **Postman Collection:** [Catering Management System](https://www.postman.com/anamulhoquewd/catering-management-system/overview)  

### 📄 API Documentation  

| Section        | Documentation Link |
|---------------|------------------|
| 🔐 **Authentication** | [View Documentation](https://documenter.getpostman.com/view/31092031/2sAYX3r3Pg) |
| 👥 **Users** | [View Documentation](https://documenter.getpostman.com/view/31092031/2sAYXEEdhz) |
| 🏠 **Customers** | [View Documentation](https://documenter.getpostman.com/view/31092031/2sAYXEEddf) |
| 📦 **Orders** | [View Documentation](https://documenter.getpostman.com/view/31092031/2sAYXEEddh) |
| 💳 **Payments** | [View Documentation](https://documenter.getpostman.com/view/31092031/2sAYXEEddi) |
| 🙍‍♂️ **Profile** | [View Documentation](https://documenter.getpostman.com/view/31092031/2sAYXEEdhy) |

## Contact
If you have any questions or feedback, please don't hesitate to reach out to me.  
📧 **Email:** [anamulhoquewd](mailto:anamulhoquewd)

🔗 **GitHub:** [anamulhoquewd](https://github.com/anamulhoquewd)

🔗 **LinkedIn:** [anamulhoquewd](https://linkedin.com/in/anamulhoquewd)

🔗 **Facebook:** [anamulhoquewd](https://facebook.com/anamulhoquewd)

🔗 **WhatsApp:** [anamulhoquewd](https://wa.me/01975024242)

🔗 **Website:** [anamulhoquewd](https://anamulhoquewd.github.io)