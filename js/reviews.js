document.addEventListener("DOMContentLoaded", function () {
  const carouselContainer = document.querySelector(".client_owl-carousel");

  if (carouselContainer) {
    fetch("reviews.json")
      .then((response) => response.json())
      .then((reviews) => {
        reviews.forEach((review) => {
          const item = document.createElement("div");
          item.classList.add("item");
          item.innerHTML = `
            <div class="box">
              <div class="img-box">
                <img src="${review.image}" alt="" class="box-img">
              </div>
              <div class="detail-box">
                <div class="client_id">
                  <div class="client_info">
                    <h6>${review.name}</h6>
                    <p>${review.location}</p>
                  </div>
                  <i class="fa fa-quote-left" aria-hidden="true"></i>
                </div>
                <p>${review.review}</p>
              </div>
            </div>
          `;
          carouselContainer.appendChild(item);
        });

        // Initialize Owl Carousel after adding items
        $(".client_owl-carousel").owlCarousel({
          loop: true,
          margin: 20,
          dots: false,
          nav: true,
          autoplay: true,
          autoplayHoverPause: true,
          navText: [
            '<i class="fa fa-angle-left" aria-hidden="true"></i>',
            '<i class="fa fa-angle-right" aria-hidden="true"></i>',
          ],
          responsive: {
            0: {
              items: 1,
            },
            600: {
              items: 2,
            },
            1000: {
              items: 2,
            },
          },
        });
      })
      .catch((error) => console.error("Error loading reviews:", error));
  }
});
