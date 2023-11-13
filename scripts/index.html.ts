export default /* html */`
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="description" content="SwaggerUI"/>
	<title>Swagger UI</title>
	<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
	<script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js" crossorigin></script>
</head>
<body>
<div id="swagger-ui"></div>
<script>
	window.onload = () => {
		window.ui = SwaggerUIBundle({
			url: "{url}",
			dom_id: "#swagger-ui",
		});
	};
</script>
</body>
</html>
`;
