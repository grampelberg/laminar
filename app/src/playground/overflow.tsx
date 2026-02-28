import { FileWarning } from 'lucide-react'

export const Overflow = () => (
  <div className="h-48 w-full">
    <div className="relative mx-auto h-full w-48">
      <div className="absolute inset-0 h-full w-[calc(100%+50px)] overflow-auto border border-l-green-500">
        <div className="relative mx-6 border border-amber-500 whitespace-nowrap">
          <div className="absolute top-1/2 left-0 z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-full bg-card/90 shadow-xs backdrop-blur-[1px]">
              <FileWarning className="size-5" />
            </div>
          </div>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non
          risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec,
          ultricies sed, dolor. Cras elementum ultrices diam. Maecenas ligula
          massa, varius a, semper congue, euismod non, mi. Proin porttitor, orci
          nec nonummy molestie, enim est eleifend mi, non fermentum diam nisl
          sit amet erat. Duis semper. Duis arcu massa, scelerisque vitae,
          consequat in, pretium a, enim. Pellentesque congue. Ut in risus
          volutpat libero pharetra tempor. Cras vestibulum bibendum augue.
          Praesent egestas leo in pede. Praesent blandit odio eu enim.
          Pellentesque sed dui ut augue blandit sodales. Vestibulum ante ipsum
          primis in faucibus orci luctus et ultrices posuere cubilia Curae;
          Aliquam nibh. Mauris ac mauris sed pede pellentesque fermentum.
          Maecenas adipiscing ante non diam sodales hendrerit. Ut velit mauris,
          egestas sed, gravida nec, ornare ut, mi. Aenean ut orci vel massa
          suscipit pulvinar. Nulla sollicitudin. Fusce varius, ligula non tempus
          aliquam, nunc turpis ullamcorper nibh, in tempus sapien eros vitae
          ligula. Pellentesque rhoncus nunc et augue. Integer id felis.
          Curabitur aliquet pellentesque diam. Integer quis metus vitae elit
          lobortis egestas. Lorem ipsum dolor sit amet, consectetuer adipiscing
          elit. Morbi vel erat non mauris convallis vehicula.
        </div>
      </div>
    </div>
  </div>
)
